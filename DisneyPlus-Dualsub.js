/*
    Disney+ Dualsub for Surge by Neurogram
 
        - Disney+ bilingual subtitles
        - Official subtitles support
        - Machine translation support (Google, DeepL)
        - Customized language support
 
    Manual：
        Shortcuts: https://www.icloud.com/shortcuts/aa6056ad31c14f25aedbee6cd1d7a799

        Surge:

        [Script]
        DisneyPlus-Dualsub = type=http-response,pattern=https:\/\/.+media.dssott.com\/ps01\/disney\/.+(\.vtt|-all-.+\.m3u8.*),requires-body=true,max-size=0,script-path=DisneyPlus-Dualsub.js
        DisneyPlus-Dualsub-Setting = type=http-request,pattern=https:\/\/.+media.dssott.com\/ps01\/disney\?action=(get|set),requires-body=1,max-size=0,script-path=DisneyPlus-Dualsub.js
 
        [MITM]
        hostname = *.media.dssott.com

    Author:
        Telegram: Neurogram
        GitHub: Neurogram-R
*/

let url = $request.url
let headers = $request.headers

let setting = $persistentStore.read()

if (!setting || !setting.match(/{/)) setting = {
    type: "Official", // Official、Google、DeepL、Disable
    lang: "English [CC]",
    sl: "zh-CN",
    tl: "en",
    line: "s", // f、s
    dkey: "null", // DeepL API key
    subtitles: "null"
}

if (typeof (setting) == "string") setting = JSON.parse(setting)

if (url.match(/action=get/)) $done({ response: { body: JSON.stringify(setting) } })

if (url.match(/action=set/)) {
    let new_setting = JSON.parse($request.body)
    if (new_setting.type) setting.type = new_setting.type
    if (new_setting.lang) setting.lang = new_setting.lang
    if (new_setting.sl) setting.sl = new_setting.sl
    if (new_setting.tl) setting.tl = new_setting.tl
    if (new_setting.line) setting.line = new_setting.line
    if (new_setting.dkey) setting.dkey = new_setting.dkey
    if (new_setting.subtitles) setting.subtitles = new_setting.subtitles
    $persistentStore.write(JSON.stringify(setting))
    $done({ response: { body: JSON.stringify(setting) } })
}

let body = $response.body

if (setting.type == "Disable") $done({ body })
if (setting.type != "Official" && url.match(/\.m3u8/)) $done({ body })

let subtitles_urls_data = setting.subtitles

let host = url.match(/https.+media.dssott.com\/ps01\/disney\/[^\/]+/)[0]

if (setting.type == "Official" && url.match(/\.m3u8/)) {
    setting.subtitles = "null"
    $persistentStore.write(JSON.stringify(setting))

    let patt = new RegExp(`TYPE=SUBTITLES.+NAME="${setting.lang.replace(/(\[|\]|\(|\))/g, "\\$1")}.+URI="([^"]+)`)

    if (body.match(patt)) {

        let subtitles_data_link = `${host}/${body.match(patt)[1]}`

        let options = {
            url: subtitles_data_link,
            headers: headers
        }

        $httpClient.get(options, function (error, response, data) {
            let subtitles_data = data.match(/.+-MAIN.+\.vtt/g)

            if (subtitles_data) {
                setting.subtitles = subtitles_data.join("\n")
                $persistentStore.write(JSON.stringify(setting))
            }

            if (subtitles_data_link.match(/.+-MAIN.+/) && data.match(/,\nseg.+\.vtt/g)) {
                subtitles_data = data.match(/,\nseg.+\.vtt/g)
                let url_path = subtitles_data_link.match(/\/r\/(.+)/)[1].replace(/\w+\.m3u8/, "")
                setting.subtitles = subtitles_data.join("\n").replace(/,\n/g, url_path)
                $persistentStore.write(JSON.stringify(setting))
            }

            $done({ body })
        })

    }

    if (!body.match(patt)) $done({ body })
}

if (url.match(/\.vtt/)) {
    if (setting.type == "Official") {
        if (subtitles_urls_data == "null") $done({ body })
        subtitles_urls_data = subtitles_urls_data.match(/.+\.vtt/g)
        if (subtitles_urls_data) official_subtitles(subtitles_urls_data)
    }

    if (setting.type == "Google") machine_subtitles("Google")

    if (setting.type == "DeepL") machine_subtitles("DeepL")
}

async function machine_subtitles(type) {

    body = body.replace(/(\d+:\d\d:\d\d.\d\d\d -->.+line.+,end\n.+)\n(.+)/g, "$1 $2")

    let dialogue = body.match(/\d+:\d\d:\d\d.\d\d\d -->.+line.+,end\n.+/g)

    if (!dialogue) $done({ body })

    let timeline = body.match(/\d+:\d\d:\d\d.\d\d\d -->.+line.+,end/g)

    let s_sentences = []
    let s_d_sentences = []
    for (var i in dialogue) {
        s_sentences.push("~" + i + "~" + dialogue[i].replace(/\d+:\d\d:\d\d.\d\d\d -->.+line.+,end\n/, ""))
        s_d_sentences.push("&text=" + dialogue[i].replace(/\d+:\d\d:\d\d.\d\d\d -->.+line.+,end\n/, ""))
    }

    let t_sentences = []

    if (type == "Google") {
        let options = {
            url: `https://translate.google.com/translate_a/single?client=it&dt=qca&dt=t&dt=rmt&dt=bd&dt=rms&dt=sos&dt=md&dt=gt&dt=ld&dt=ss&dt=ex&otf=2&dj=1&hl=en&ie=UTF-8&oe=UTF-8&sl=${setting.sl}&tl=${setting.tl}`,
            headers: {
                "User-Agent": "GoogleTranslate/6.29.59279 (iPhone; iOS 15.4; en; iPhone14,2)"
            },
            body: `q=${encodeURIComponent(s_sentences.join("\n"))}`
        }

        let trans = await send_request(options, "post")

        if (trans.sentences) {
            let sentences = trans.sentences

            for (let k in sentences) {
                if (sentences[k].trans) t_sentences.push(sentences[k].trans.replace(/\n$/g, "").replace(/\n/g, " ").replace(/〜/g, "~"))
            }

            t_sentences = t_sentences.join(" ").match(/~\d+~[^~]+/g)
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
            url: `${host}/r/${subtitles_urls_data[k]}`,
            headers: headers
        }
        result.push(await send_request(options, "get"))
    }

    body = body.replace(/(\d+:\d\d:\d\d.\d\d\d -->.+line.+,end\n.+)\n(.+)/g, "$1 $2")

    let timeline = body.match(/\d+:\d\d:\d\d.\d\d\d -->.+line.+,end/g)

    for (var i in timeline) {
        let patt1 = new RegExp(`(${timeline[i]})`)
        if (setting.line == "s") patt1 = new RegExp(`(${timeline[i]}(\\n.+)+)`)

        let time = timeline[i].match(/^\d+:\d\d:\d\d/)[0]

        let patt2 = new RegExp(`${time}.\\d\\d\\d -->.+line.+,end(\\n.+)+`)

        let dialogue = result.join("\n\n").match(patt2)

        if (dialogue) body = body.replace(
            patt1,
            `$1\n${dialogue[0]
                .replace(/\d+:\d\d:\d\d.\d\d\d -->.+line.+,end\n/, "")
                .replace(/\n/, " ")}`
        )

    }

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
