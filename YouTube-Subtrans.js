/*
    YouTube Subtrans for Surge by Neurogram
 
        - YouTube subtitles auto-translate
 
    Manual:
        Shortcuts: https://www.icloud.com/shortcuts/a0c3f95778ef4c18970da66fda40b29b

        Surge:

        [Script]
        YouTube-Subtrans = type=http-request,pattern=https:\/\/www.youtube.com\/api\/timedtext.+,requires-body=1,max-size=0,script-path=YouTube-Subtrans.js
 
        [MITM]
        hostname = www.youtube.com

    Author:
        Telegram: Neurogram
        GitHub: Neurogram-R
*/

let url = $request.url

let setting = $persistentStore.read()

if (!setting || !setting.match(/{/)) setting = {
    status: "Enable", // Enable, Disable
    lang: "English",
    tl: "en",
}

if (typeof (setting) == "string") setting = JSON.parse(setting)

if (url.match(/action=get/)) $done({ response: { body: JSON.stringify(setting) } })

if (url.match(/action=set/)) {
    let new_setting = JSON.parse($request.body)
    if (new_setting.status) setting.status = new_setting.status
    if (new_setting.lang) setting.lang = new_setting.lang
    if (new_setting.tl) setting.tl = new_setting.tl
    $persistentStore.write(JSON.stringify(setting))
    $done({ response: { body: JSON.stringify(setting) } })
}

if (setting.status == "Disable") $done({})

let patt = new RegExp(`lang=${setting.tl}`)

if (url.match(patt)) $done({})

if (url.match(/&tlang=/)) $done({})

$done({ url: `${url}&tlang=${setting.tl == "zh-CN" ? "zh-Hans" : setting.tl == "zh-TW" ? "zh-Hant" : setting.tl}` })