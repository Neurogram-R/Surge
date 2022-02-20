/*
    HBO Max Dualsub for Surge by Neurogram
 
        - HBO Max bilingual subtitles
        - Official subtitles support
        - Machine translation support (Google, DeepL)
        - Customized language support
 
    Manual:
        Shortcuts: https://www.icloud.com/shortcuts/9b27f9c335b54fc886849f99d6375cab

        Surge:

        [Script]
        HBO-Max-Dualsub = type=http-response,pattern=https:\/\/(manifests.v2.api.hbo.com|.+hbomaxcdn.com)\/(hls.m3u8.+|video.+\.vtt$),requires-body=1,max-size=0,timeout=30,script-path=HBO-Max-Dualsub.js
        HBO-Max-Dualsub-Setting = type=http-request,pattern=https:\/\/setting.hbomaxcdn.com\/vtt\?action=(get|set),requires-body=1,max-size=0,script-path=HBO-Max-Dualsub.js

        [MITM]
        hostname = *.api.hbo.com, *.hbomaxcdn.com

    Author:
        Telegram: Neurogram
        GitHub: Neurogram-R
*/

let url = $request.url
let headers = $request.headers

let setting = $persistentStore.read()

if (!setting || !setting.match(/{/)) setting = {
    type: "Official", // Official, Google, DeepL, Disable
    lang: "English CC",
    sl: "es-419",
    tl: "en-US SDH",
    line: "s", // f, s
    dkey: "null", // DeepL API key
    s_subtitles_url: "null",
    t_subtitles_url: "null",
    subtitles: "null",
    subtitles_type: "null",
    subtitles_sl: "null",
    subtitles_tl: "null",
    subtitles_line: "null",
}

if (typeof (setting) == "string") setting = JSON.parse(setting)

if (url.match(/action=get/)) {
    delete setting.t_subtitles_url
    delete setting.subtitles
    $done({ response: { body: JSON.stringify(setting) } })
}

if (url.match(/action=set/)) {
    let new_setting = JSON.parse($request.body)
    if (new_setting.type) setting.type = new_setting.type
    if (new_setting.lang) setting.lang = new_setting.lang
    if (new_setting.sl) setting.sl = new_setting.sl
    if (new_setting.tl) setting.tl = new_setting.tl
    if (new_setting.line) setting.line = new_setting.line
    if (new_setting.dkey) setting.dkey = new_setting.dkey
    if (new_setting.s_subtitles_url) setting.s_subtitles_url = new_setting.s_subtitles_url
    if (new_setting.t_subtitles_url) setting.t_subtitles_url = new_setting.t_subtitles_url
    if (new_setting.subtitles) setting.subtitles = new_setting.subtitles
    if (new_setting.subtitles_type) setting.subtitles_type = new_setting.subtitles_type
    if (new_setting.subtitles_sl) setting.subtitles_sl = new_setting.subtitles_sl
    if (new_setting.subtitles_tl) setting.subtitles_tl = new_setting.subtitles_tl
    if (new_setting.subtitles_line) setting.subtitles_line = new_setting.subtitles_line
    $persistentStore.write(JSON.stringify(setting))
    delete setting.t_subtitles_url
    delete setting.subtitles
    $done({ response: { body: JSON.stringify(setting) } })
}

let body = $response.body

if (setting.type == "Disable") $done({})
if (setting.type != "Official" && url.match(/\.m3u8/)) $done({})

let subtitles_urls_data = setting.t_subtitles_url

if (setting.type == "Official" && url.match(/\.m3u8/)) {
    setting.t_subtitles_url = "null"
    $persistentStore.write(JSON.stringify(setting))

    let patt = new RegExp(`TYPE=SUBTITLES.+NAME="${setting.tl.replace(/(\[|\]|\(|\))/g, "\\$1")}.+URI="([^"]+)`)

    if (body.match(patt)) {

        let subtitles_data_link = body.match(patt)[1]

        let options = {
            url: subtitles_data_link,
            headers: headers
        }

        $httpClient.get(options, function (error, response, data) {
            let subtitles_data = data.match(/http.+\.vtt/g)

            if (subtitles_data) {
                setting.t_subtitles_url = subtitles_data.join("\n")
                $persistentStore.write(JSON.stringify(setting))
            }

            $done({})
        })

    }

    if (!body.match(patt)) $done({})
}

if (url.match(/\.vtt/)) {

    if (url == setting.s_subtitles_url && setting.subtitles != "null" && setting.subtitles_type == setting.type && setting.subtitles_sl == setting.sl && setting.subtitles_tl == setting.tl && setting.subtitles_line == setting.line) $done({ body: setting.subtitles })

    if (setting.type == "Official") {
        if (subtitles_urls_data == "null") $done({})
        subtitles_urls_data = subtitles_urls_data.match(/http.+\.vtt/g)
        if (subtitles_urls_data) official_subtitles(subtitles_urls_data)
    }

    if (setting.type == "Google") machine_subtitles("Google")

    if (setting.type == "DeepL") machine_subtitles("DeepL")
}


async function machine_subtitles(type) {

    body = body.replace(/(\d+:\d\d:\d\d.\d\d\d -->.+line.+size:\d+%.*\n.+)\n(.+)/g, "$1 $2")
    body = body.replace(/(\d+:\d\d:\d\d.\d\d\d -->.+line.+size:\d+%.*\n.+)\n(.+)/g, "$1 $2")

    let dialogue = body.match(/\d+:\d\d:\d\d.\d\d\d -->.+line.+size:\d+%.*\n.+/g)

    if (!dialogue) $done({})

    let timeline = body.match(/\d+:\d\d:\d\d.\d\d\d -->.+line.+size:\d+%.*/g)

    let s_sentences = []
    let s_d_sentences = []
    for (var i in dialogue) {
        s_sentences.push("~" + i + "~" + dialogue[i].replace(/\d+:\d\d:\d\d.\d\d\d -->.+line.+size:\d+%.*\n/, ""))
        s_d_sentences.push("&text=" + dialogue[i].replace(/\d+:\d\d:\d\d.\d\d\d -->.+line.+size:\d+%.*\n/, ""))
    }

    let t_sentences = []

    if (type == "Google") {
        s_sentences = groupAgain(s_sentences, 100)
        let trans_result = []

        for (var p in s_sentences) {
            let options = {
                url: `https://translate.google.com/translate_a/single?client=it&dt=qca&dt=t&dt=rmt&dt=bd&dt=rms&dt=sos&dt=md&dt=gt&dt=ld&dt=ss&dt=ex&otf=2&dj=1&hl=en&ie=UTF-8&oe=UTF-8&sl=${setting.sl}&tl=${setting.tl}`,
                headers: {
                    "User-Agent": "GoogleTranslate/6.29.59279 (iPhone; iOS 15.4; en; iPhone14,2)"
                },
                body: `q=${encodeURIComponent(s_sentences[p].join("\n"))}`
            }

            let trans = await send_request(options, "post")

            if (trans.sentences) {
                let sentences = trans.sentences
                for (var k in sentences) {
                    if (sentences[k].trans) trans_result.push(sentences[k].trans.replace(/\n$/g, "").replace(/\n/g, " ").replace(/〜/g, "~"))
                }
            }
        }

        if (trans_result.length > 0) {
            t_sentences = trans_result.join(" ").match(/~\d+~[^~]+/g)
        }

    }

    if (type == "DeepL") {

        s_d_sentences = groupAgain(s_d_sentences, 50)
        let trans_result = []

        for (var l in s_d_sentences) {
            let options = {
                url: "https://api-free.deepl.com/v2/translate",
                body: `auth_key=${setting.dkey}${setting.sl == "auto" ? "" : `&source_lang=${setting.sl}`}&target_lang=${setting.tl}${s_d_sentences[l].join("")}`
            }

            let trans = await send_request(options, "post")

            if (trans.translations) trans_result.push(trans.translations)
        }

        if (trans_result.length > 0) {
            for (var o in trans_result) {
                for (var u in trans_result[o]) {
                    t_sentences.push(trans_result[o][u].text.replace(/\n/g, " "))
                }
            }
        }
    }

    if (t_sentences.length > 0) {
        let g_t_sentences = t_sentences.join("\n").replace(/\s\n/g, "\n")

        for (var j in dialogue) {
            let patt = new RegExp(`(${timeline[j]})`)
            if (setting.line == "s") patt = new RegExp(`(${dialogue[j].replace(/(\[|\]|\(|\)|\?)/g, "\\$1")})`)

            let patt2 = new RegExp(`~${j}~\\s*(.+)`)

            if (g_t_sentences.match(patt2) && type == "Google") body = body.replace(patt, `$1\n${g_t_sentences.match(patt2)[1]}`)

            if (type == "DeepL") body = body.replace(patt, `$1\n${t_sentences[j]}`)

        }
        setting.s_subtitles_url = url
        setting.subtitles = body
        setting.subtitles_type = setting.type
        setting.subtitles_sl = setting.sl
        setting.subtitles_tl = setting.tl
        setting.subtitles_line = setting.line
        $persistentStore.write(JSON.stringify(setting))
    }

    $done({ body })

}

async function official_subtitles(subtitles_urls_data) {
    let result = []

    let subtitles_index = parseInt(url.match(/(\d+)\.vtt/)[1])

    let start = subtitles_index - 3 < 0 ? 0 : subtitles_index - 3

    subtitles_urls_data = subtitles_urls_data.slice(start, subtitles_index + 4)

    for (var k in subtitles_urls_data) {
        let options = {
            url: subtitles_urls_data[k],
            headers: headers
        }
        result.push(await send_request(options, "get"))
    }

    body = body.replace(/(\d+:\d\d:\d\d.\d\d\d -->.+line.+size:\d+%.*\n.+)\n(.+)/g, "$1 $2")
    body = body.replace(/(\d+:\d\d:\d\d.\d\d\d -->.+line.+size:\d+%.*\n.+)\n(.+)/g, "$1 $2")

    let timeline = body.match(/\d+:\d\d:\d\d.\d\d\d -->.+line.+size:\d+%.*/g)

    for (var i in timeline) {
        let patt1 = new RegExp(`(${timeline[i]})`)
        if (setting.line == "s") patt1 = new RegExp(`(${timeline[i]}(\\n.+)+)`)

        let time = timeline[i].match(/^\d+:\d\d:\d\d/)[0]

        let patt2 = new RegExp(`${time}.\\d\\d\\d -->.+line.+size:\\d+%(\\n.+)+`)

        let dialogue = result.join("\n\n").match(patt2)

        if (dialogue) body = body.replace(
            patt1,
            `$1\n${dialogue[0]
                .replace(/\d+:\d\d:\d\d.\d\d\d -->.+line.+size:\d+%.*\n/, "")
                .replace(/\n/, " ")}`
        )
    }

    setting.s_subtitles_url = url
    setting.subtitles = body
    setting.subtitles_type = setting.type
    setting.subtitles_sl = setting.sl
    setting.subtitles_tl = setting.tl
    setting.subtitles_line = setting.line
    $persistentStore.write(JSON.stringify(setting))

    $done({ body })
}

function send_request(options, method) {
    return new Promise((resolve, reject) => {

        if (method == "get") {
            $httpClient.get(options, function (error, response, data) {
                if (error) return reject('Error')
                resolve(data)
            })
        }

        if (method == "post") {
            $httpClient.post(options, function (error, response, data) {
                if (error) return reject('Error')
                resolve(JSON.parse(data))
            })
        }

    })
}

function groupAgain(data, num) {
    var result = []
    for (var i = 0; i < data.length; i += num) {
        result.push(data.slice(i, i + num))
    }
    return result
}