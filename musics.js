'use strict'

import GoogleSignIn from './GoogleSignInJS/google_signin.js'
import Mirror from './Mirror/Mirror.js'

// ------------------------------------------- TO CHANGE

function round_button(icon,type='fab',more_class='') {
    let btn = $('<button>').addClass('mdl-button mdl-js-button mdl-button--'+type+' '+more_class)
    .append($('<i>').addClass('material-icons').html(icon))
    return btn
}

function text_button(text,type='raised',more_class='') {
    let btn = $('<button>').addClass(more_class)
    .addClass('mdl-button mdl-js-button')
    .addClass('mdl-button--'+type+' mdl-js-ripple-effect')
    .css('margin',10).html(text)
    return btn
}


(async function() {

    // ----------------------------------------------------- VAR

    var mirror = new Mirror('./Mirror/')
    var gsi = new GoogleSignIn(
        '620338708041-bvdfrtog21r9jmgquf1j6v5e62pmr7ck.apps.googleusercontent.com',
        'https://www.googleapis.com/auth/youtube.force-ssl'
    )
    var youtube_api = await gsi.get_api(
        'https://www.googleapis.com/discovery/v1/apis/youtube/v3/rest',
        'AIzaSyDynb2RS_p_GayMpF3Ba3RoEcfZz2oQyDQ',
        'youtube'
    )

    var reco = new webkitSpeechRecognition();
    reco.continuous = true;
    reco.interimResults = true;
    
    // ----------------------------------------------------- DATA

    function get_recognition(callback=function(){}) {
        reco.stop()
        return new Promise(ok=> {
            reco.onresult = function(event) {
                let result = event.results[event.results.length-1]
                let transcript = result[0].transcript
                callback(transcript)
                if(result.isFinal) {
                    reco.stop()
                    ok(transcript)
                }
            }
            reco.onend(function() {

            })
            reco.start();
        })
    }

    function uuid() {
        return Math.random()+''+Date.now()
    }

    async function create_link(list_id, link_name=null) {
        link_name = link_name==null?prompt('link name'):link_name
        if(link_name == null) {
            return null
        }
        alert('Your friends have 1 minute to link to "'+link_name+'"')
        await mirror.create_base(link_name,{list_id})
        setTimeout(function() {
            mirror.bm.key_remove(link_name)
        },60*1000)
    }

    async function autocomplete(query) {
        return new Promise(ok=>{
            const makeCallback = script => response => {
                document.head.removeChild(script)
                ok(response[1])
            }

            let s = document.createElement('script')
            s.charset = 'utf-8'
            s.src = 'https://suggestqueries.google.com/complete/search?client=youtube&ds=yt&q='+query+'&callback=suggestCallback'
            window.suggestCallback = makeCallback(s)
            document.head.appendChild(s)
        })
    }
    
    // ----------------------------------------------------- MIRROR

    async function get_user_connector() {
        let profile_data = await gsi.get_profile_data()
        return await mirror.connect('user_musics_'+profile_data.id)
    }

    async function get_current_list_connector() {
        let user_connector = await get_user_connector()
        let current_list_id = user_connector.get_direct('current_id_list',null)
        if(current_list_id == null) {
            current_list_id = await ask_user_list_id()
            user_connector.set_direct('current_id_list',current_list_id)
            return await get_current_list_connector()
        }
        return await mirror.connect(current_list_id)
    }
    
    // ----------------------------------------------------- DISP

    // --------------------

    async function disp_autocomplete(underjq,names,name_selected) {
        return new Promise(ok=>{
            if($('.autocomplete').length > 0) {
                $('.autocomplete').remove()
            }
            let jq = $('<div>').addClass('autocomplete')
            let top = underjq.offset().top
            let left = underjq.offset().left
            let width = underjq.outerWidth()
            let height = underjq.outerHeight()
            jq.css('top',top+height).css('left',left).css('width',width-10)

            for(let name of names) {
                let name_jq = $('<div>').addClass('choice')
                .html(name)
                jq.append(name_jq)
                name_jq.click(function() {
                    jq.remove()
                    name_selected(name)
                })
            }
            $('body').append(jq)
        })
    }

    // --------------------
        
    function create_music_jq(id, item, list_connector, user_data) {
        let jq = $('<div>').addClass('music').addClass('appear')
        let title = $('<div>').addClass('title')
        let description = $('<div>').addClass('description')
        let progress = $('<div>').addClass('progress')
        jq.append(progress).append(title).append(description)
        let user_id = item.user
        list_connector.on_prop('set',['musics',id],'title',function(new_title) {
            if(new_title.length > 25) {
                new_title = new_title.slice(0,25)+'...'
            }
            title.html(new_title)
        })
        list_connector.on_prop('set',['musics',id],'description',function(new_desc) {
            description.html(new_desc)
        })
        list_connector.on_prop('set',['musics',id],'enabled',function(is_enabled) {
            jq.removeClass('disabled')
            if(!is_enabled) {
                jq.addClass('disabled')
            }
        })
        list_connector.on_prop('set',['musics',id],'playing',function(is_playing) {
            console.log('CHANGE',is_playing)
            jq.removeClass('playing')
            if(is_playing) {
                jq.removeClass('disabled')
                jq.addClass('playing')
            }
        })
        list_connector.on_prop('set',['musics',id],'time',function(new_time) {
            let duration = list_connector.get(['musics',id],'duration',1)
            let percent = (new_time/duration)*100
            progress.css('width',percent+'%')
        })
        list_connector.on_prop('del',['musics'],id,function() {
            let height = jq.outerHeight()
            let container = $('<div>').addClass('music_disappear_container')
            container.css('height',(height+20)+'px')
            .append(jq.clone().removeClass('appear'))
            jq.replaceWith(container)
            setTimeout(function() {
                container.remove()
            },1000)
        })
        if(user_id == user_data.id) {
            let remove_button = round_button('cancel','icon','delete')
            let reload_button = round_button('replay','icon','reload')
            jq.append(remove_button).append(reload_button)
            remove_button.click(function() {
                if(!list_connector.get(['musics',id],'enabled')) {
                    list_connector.del(['musics'],id)
                    return
                }
                list_connector.set(['musics',id],'enabled',false)
            })
            reload_button.click(function() {
                list_connector.set(['musics',id],'enabled',true)
            })
        } else {
            let user_btn = $('<div>').addClass('user')
            list_connector.on_prop('set',['users',user_id],'image',function(url) {
                user_btn.css('background-image','url("'+url+'")')
            })
            jq.append(user_btn)
        }
        
        return jq
    }

    // --------------------

    async function disp_list() {

        return new Promise(async function(end) {

            let list_connector = await get_current_list_connector()

            let profile = await gsi.get_profile_data()
            let user_data = {id:profile.id,image:profile.image_url}
            list_connector.set(['users'],profile.id,user_data)

            // --- JQ

            $('.container').html('').css('background','#FFFFFF')
            $('meta[name=theme-color]').attr('content','#FFFFFF')
            let bar = $('<div>').addClass('menu')

            let musics_panel = $('<div>').addClass('musics_panel')

            let play = round_button('play_arrow','fab','play')
            let mic = round_button('mic','fab','mic')
            let input = $('<input>').addClass('search')
            let exit = round_button('arrow_back','fab','bb exit')
            let link = round_button('link','fab','bb create_link')
            bar.append(mic).append(input).append(exit).append(link)

            $('.container').append(play).append(bar).append(musics_panel)

            // --- FCT

            async function add_music(title, description, video_id) {
                let id = uuid()
                let music_item = {id,title,description,
                    playing:false,
                    time:0,
                    enabled:true,
                    video_id,
                    user:user_data.id}
                list_connector.set(['musics'],id,music_item)
            }

            async function launch_auto_query(query, set_first=false) {
                let data = await autocomplete(query)
                let words = data.map(elm=>elm[0])
                async function set_youtube_first(query) {
                    let options = {"part": "snippet","maxResults": 10,"q": query}
                    let responses = await youtube_api.search.list(options)
                    let item = responses.result.items[0]
                    let index = 1
                    while(!item.id.hasOwnProperty('videoId')) {
                        item = responses.result.items[index]
                        index++
                    }
                    let title = item.snippet.title
                    let video_id = item.id.videoId
                    add_music(query, title, video_id)
                    input.val('')
                }
                if(set_first) {
                    let query = words[0]
                    set_youtube_first(query)
                } else {
                    disp_autocomplete(input,words,async function(query) {
                        input.val(query)
                        await set_youtube_first(query)
                    })
                }
            }

            var play_int = null
            var player = null

            function pause_list() {
                $('.play i').html('play_arrow')
                list_connector.set_direct('playing',false)
                player.pauseVideo()
            }

            function play_list() {
                if(player != null) {
                    $('.play i').html('pause')
                    list_connector.set_direct('playing',true)
                    player.playVideo()
                    return
                }
                player = null
                let musics = list_connector.get_direct('musics')
                let ids = Object.keys(musics)
                if(ids.length == 0) {
                    return
                }
                let first_id = ids[0]
                let first_song = musics[first_id]

                function end_playing() {
                    clearInterval(play_int)
                    list_connector.set_direct('playing',false)
                    list_connector.del(['musics'],first_id)
                    setTimeout(function() {
                        play_list()
                    },1000)
                }

                if(!first_song.enabled) {
                    end_playing()
                    return
                }

                $('.play i').html('pause')
                list_connector.set_direct('playing',true)

                $('#player').replaceWith($('<div>').attr('id','player'))
                player = new YT.Player('player', {
                    height: '360',
                    width: '480',
                    videoId: first_song.video_id,
                    events: {
                        'onReady': function() {
                            player.playVideo()
                            let current_time = list_connector.get(['musics',first_id],'time',0)
                            player.seekTo(current_time)
                            setTimeout(function() {
                                console.log('SET')
                                list_connector.set(['musics',first_id],'duration',player.getDuration())
                                list_connector.set(['musics',first_id],'playing',true)
                                console.log(list_connector.get(['musics',first_id],'playing'))
                            },1000)
                        },
                        'onStateChange': function(event) {
                            if (event.data == YT.PlayerState.ENDED) {
                                end_playing()
                            }
                        }
                    }
                });

                clearInterval(play_int)
                play_int = setInterval(function() {
                    let time = player.getCurrentTime()
                    list_connector.set(['musics',first_id],'time',time)
                },100)
            }

            if(list_connector.get_direct('playing',false)) {
                play_list()
            }
            
            // --- CLICK

            link.click(function() {
                create_link(list_connector.get_direct('id'),list_connector.get_direct('name'))
            })

            play.click(function() {
                if(list_connector.get_direct('playing',false)) {
                    pause_list()
                } else {
                    play_list()
                }
            })

            var qwaiter = null
            input.keyup(function() {
                let query = input.val()
                clearTimeout(qwaiter)
                qwaiter = setTimeout(async function() {
                    launch_auto_query(query)
                },200)
            })

            mic.click(async function() {
                mic.addClass('listening')
                let query = await get_recognition(function(query) {
                    input.val(query)
                })
                mic.removeClass('listening')
                launch_auto_query(query,true)
            })

            exit.click(async function() {
                let user_connector = await get_user_connector()
                user_connector.del_direct('current_id_list')
                end()
            })

            // --- EVT

            list_connector.on_path('add',['musics'],function(id, music) {
                let jq = create_music_jq(id, music, list_connector, user_data)
                musics_panel.append(jq)
            })
        })

    }

    async function ask_user_list_id() {

        return new Promise(async function(ok) {

            $('.container').html('').css('background','#FF0000')
            $('meta[name=theme-color]').attr('content','#FF0000')
            let add = round_button('add','icon','add')
            let lnk = round_button('link','icon','link')
            let bar = $('<div>').addClass('choice_bar')
            bar.append(add).append(lnk)
            $('.container').append(bar)

            add.click(async function() {
                let name = prompt('list name')
                if(name == null) {
                    return
                }
                let id = uuid()
                let new_list = {id,name,musics:{},users:{}}
                await mirror.create_base(id,new_list)
                await create_link(id, name)
                ok(id)
            })
            lnk.click(async function() {
                let link_name = prompt('link name')
                if(link_name == null) {
                    return
                }
                if(!await mirror.can_connect(link_name)) {
                    alert('link name not found')
                    return
                }
                let list_id = (await mirror.bm.read_key(link_name)).list_id
                ok(list_id)
            })

        })

    }
    
    // ----------------------------------------------------- MAIN

    while(true) {
        await disp_list()
    }

})()