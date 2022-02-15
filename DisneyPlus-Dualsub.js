/*
    Disney+ Dualsub for Surge by Neurogram
 
        - Disney+ bilingual subtitles
        - Customized second language support
 
    Manual：
        [Script]
        DisneyPlus-Dualsub = type=http-response,pattern=https:\/\/.+media.dssott.com\/ps01\/disney\/.+(\.vtt|-all-.+\.m3u8.*),requires-body=true,max-size=307200,script-path=DisneyPlus-Dualsub.js

        [MITM]
        hostname = *.media.dssott.com

    Author:
        Telegram: Neurogram
        GitHub: Neurogram-R
*/

let url = $request.url
let headers = $request.headers
let body = $response.body

let second_lang = "English [CC]" // Customized second language (fill language name of subtitles list)

let subtitles_urls_data = $persistentStore.read()
if (!subtitles_urls_data) subtitles_urls_data = "null"

let host = url.match(/https.+media.dssott.com\/ps01\/disney\/[^\/]+/)[0]

if (url.match(/\.m3u8/)) {

    let patt = new RegExp(`TYPE=SUBTITLES.+NAME="${second_lang.replace(/(\[|\]|\(|\))/g, "\\$1")}.+URI="([^"]+)`)

    let subtitles_data_url = body.match(patt)

    if (subtitles_data_url) {
        let options = {
            url: `${host}/${subtitles_data_url[1]}`,
            headers: headers
        }

        $httpClient.get(options, function (error, response, data) {
            let subtitles_data = data.match(/.+-MAIN.+\.vtt/g)

            if (subtitles_data) $persistentStore.write(subtitles_data.join("\n"))

            $done({ body })
        })

    } else {
        $persistentStore.write("null")
        $done({ body })
    }
}

if (url.match(/\.vtt/) && subtitles_urls_data != "null") {
    subtitles_urls_data = subtitles_urls_data.match(/.+\.vtt/g)

    if (subtitles_urls_data) merge_subtitles(subtitles_urls_data)

} else {
    $done({ body })
}

async function merge_subtitles(subtitles_urls_data) {
    let result = []

    let subtitles_index = parseInt(url.match(/(\d+)\.vtt/)[1])

    let start = subtitles_index - 3 < 0 ? 0 : subtitles_index - 3

    subtitles_urls_data = subtitles_urls_data.slice(start, subtitles_index + 4);

    for (var k in subtitles_urls_data) {
        let options = {
            url: `${host}/r/${subtitles_urls_data[k]}`,
            headers: headers
        }
        result.push(await query_subtitles(options))
    }

    let data = result.join("\n\n")

    let timeline = body.match(/\d+:\d\d:\d\d.\d\d\d -->.+line.+,end/g)

    for (var i in timeline) {
        let patt1 = new RegExp(`(${timeline[i]}(\\n.+)+)`)

        let time = timeline[i].match(/^\d+:\d\d:\d\d/)[0]

        let patt2 = new RegExp(`${time}.\\d\\d\\d -->.+line.+,end(\\n.+)+`)

        let dialogue = data.match(patt2)

        if (dialogue) {
            body = body.replace(
                patt1,
                `$1\n${dialogue[0]
                    .replace(/\d+:\d\d:\d\d.\d\d\d -->.+line.+,end\n/, "")
                    .replace(/\n/, " ")}`
            )
        }
    }

    $done({ body })
}

function query_subtitles(options) {
    return new Promise((resolve, reject) => {

        $httpClient.get(options, function (error, response, data) {
            if (error) return reject('Error')
            resolve(data)
        })

    })
}
