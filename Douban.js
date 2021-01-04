/*
Douban Movie Add-ons for Surge by Neurogram
 - 豆瓣电影移动版网页增强
 - 快捷跳转 茶杯狐、奈菲影视、555电影 搜索
 - 快捷收藏电影至 Airtable
 
关于作者
Telegram: Neurogram
GitHub: Neurogram-R


使用说明

[Script]
茶杯狐、奈菲影视、555电影
http-response ^https://m.douban.com/movie/subject/.+ script-path=Douban.js,requires-body=true,max-size=307200

Airtable 收藏
http-request ^https://m.douban.com/movie/subject/.+\?seen=\d script-path=Douban.js

[MITM]
hostname = m.douban.com

收藏功能，需自行修改代码，点击 想看 / 看过 触发收藏
*/

let url = $request.url
let movieId = url.match(/subject\/(\d+)/)
let seen = url.match(/\?seen=(\d)$/)
let collect = false  //收藏功能，默认关闭，需自行配置
if (!seen) {
    let body = $response.body
    let title = body.match(/"sub-title">([^<]+)/)
    if (title) {

        let mweb = `<a href="https://www.cupfox.com/search?key=${title[1]}"><img src="https://sg.catbox.moe/c8vszl.png" height="25" width="34.78" style="vertical-align: text-top;" /></a>
        <a href="https://www.nfmovies.com/search.php?searchword=${title[1]}"><img src="https://sg.catbox.moe/gog93l.png" height="25" width="20.11" style="vertical-align: text-top;" /></a>
<a href="https://www.o8tv.com/index.php/vod/search.html?wd=${title[1]}&submit="><img src="https://sg.catbox.moe/27bzxu.png" height="25" width="25" style="vertical-align: text-top;" /></a>`

        body = body.replace(/("sub-title">.+?)(<\/div>)/, `$1${mweb}$2`)

        if (collect) {
            body = body.replace(/<a.+pbtn.+wish.+>/, `<a href="${url}?seen=0">`)
            body = body.replace(/<a.+pbtn.+collect.+>/, `<a href="${url}?seen=1">`)
        }

        $done({ body })
    } else {
        $done({})
    }
} else {
    $httpClient.get(`https://api.douban.com/v2/movie/subject/${movieId[1]}?apikey=0df993c66c0c636e29ecbb5344252a4a`, function (error, response, data) {
        let info = JSON.parse(data)
        if (error) {
            $notification.post('获取影片信息失败', error, "");
        } else if (data.msg == "movie_not_found") {
            $notification.post('豆瓣电影', data.msg, "");
        } else {
            let casts = ""
            for (var i = 0; i < info.casts.length; i++) {
                casts = casts + info.casts[i].name + " / "
            }
            let directors = ""
            for (var k = 0; k < info.directors.length; k++) {
                directors = directors + info.directors[k].name + " / "
            }
            let title = info.title + "  " + info.original_title
            let table = {
                url: "https://api.airtable.com/v0/BASE_ID/Douban",
                headers: {
                    Authorization: "API_KEY"
                },
                body: {
                    records: [
                        {
                            "fields": {
                                "Title": title,
                                "Description": info.summary,
                                "Poster": [
                                    {
                                        "url": info.images.large
                                    }
                                ],
                                "Seen": seen[1] == 1 ? true : false,
                                "Actors": casts.replace(/\s\/\s$/, ""),
                                "Director": directors.replace(/\s\/\s$/, ""),
                                "Genre": info.genres.toString(),
                                "Douban": "https://movie.douban.com/subject/" + movieId,
                                "Rating": info.rating.average,
                                "Year": info.year
                            }
                        }
                    ]
                }
            }
            $httpClient.post(table, function (error, response, data) {
                data = JSON.parse(data)
                if (error) {
                    $notification.post('收藏失败', error, "");
                } else if (data.records) {
                    $notification.post('豆瓣电影', title + " 收藏成功", "");
                } else {
                    $notification.post('收藏失败', data.error.type, data.error.message);
                }
            })
        }
    })
    $done({ url: url.replace(/\?seen=\d/, "") })
}
