/*
    Douban Movie Add-ons for Surge by Neurogram

        - 豆瓣电影网页插件
        - 快捷跳转自定义网站搜索
        - 展示在映流媒体平台（TMDB API）

    使用说明

        [Script]
        Douban = type=http-response, pattern=https:\/\/m(ovie)*\.douban\.com\/(movie\/)*subject\/.+, requires-body=1, max-size=0, timeout=30, script-path=Douban.js

        [MITM]
        hostname = m.douban.com, movie.douban.com

    Author:
        Telegram: Neurogram
        GitHub: Neurogram-R
*/


const url = $request.url
const movieId = url.match(/subject\/(\d+)/)?.[1]
const platform = url.includes('movie.douban.com') ? 'web' : 'mobile'

const tmdb_region = 'US' // TMDB 查询区域
const tmdb_api_key = '' // TMDB API Key

// 可自定义添加网站搜索（格式：['名称', '搜索链接', '图标链接']，%@ 代表电影标题）
const watch_web_data = [
    ['247看', 'https://247kan.com/search?q=%@', 'https://247kan.com/favicon.ico'],
    ['Cupfox', 'https://www.cupfox.in/search?q=%@', 'https://picx.zhimg.com/80/v2-de36e385e59fcca2df694b76f108431a.png'],
    ['LIBIVO', 'https://www.libvio.fun/search/-------------.html?wd=%@', 'https://www.libvio.fun/statics/img/favicon.ico']
]

function send_request(options, method = 'get') {
    return new Promise((resolve, reject) => {
        $httpClient[method](options, function (error, response, data) {
            if (error) return reject('Error')
            resolve(JSON.parse(data))
        })
    })
}

async function douban_addons() {

    let body = $response.body
    const title = body.match(/"sub-title">([^<]+)/)?.[1] ?? body.match(/<i class="">(.+)?的剧情简介<\/i>/)?.[1]

    if (!title) $done({})

    if (tmdb_api_key) {

        const douban_result = await send_request({
            url: `https://frodo.douban.com/api/v2/movie/${movieId}?apiKey=0ac44ae016490db2204ce0a042db2916`,
            headers: {
                'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 MicroMessenger/8.0.3(0x18000323) NetType/WIFI Language/en',
                'Referer': 'https://servicewechat.com/wx2f9b06c1de1ccfca/82/page-frame.html'
            }
        })

        if (['movie', 'tv'].includes(douban_result.type) && douban_result.original_title) {

            const tmdb_query = await send_request({
                url: `https://api.themoviedb.org/3/search/${douban_result.type}?api_key=${tmdb_api_key}&query=${encodeURIComponent(douban_result.original_title.replace(/Season \d+$/, ''))}&page=1`
            })

            if (tmdb_query.results[0]) {

                const tmdb_providers = await send_request({
                    url: `https://api.themoviedb.org/3/${douban_result.type}/${tmdb_query.results[0].id}/watch/providers?api_key=${tmdb_api_key}`
                })

                if (tmdb_providers.results[tmdb_region]?.flatrate) {

                    for (const provider of tmdb_providers.results[tmdb_region].flatrate) {
                        watch_web_data.push([provider.provider_name, '', `https://image.tmdb.org/t/p/original${provider.logo_path}`])
                    }

                }
            }

        }

    }

    const html_data = []

    for (let i = 0; i < watch_web_data.length; i++) {
        html_data.push(`<a href="${watch_web_data[i][1].replace(/%@/, title)}"><img src="${watch_web_data[i][2]}" height="25" style="width: auto; vertical-align: text-top;" /></a>`)
    }

    if (platform == 'web') body = body.replace(/(<span property="v:itemreviewed">(.|\n)+?)<\/h1>/, `$1${html_data.join('\n')}</h1>$2`)
    if (platform == 'mobile') body = body.replace(/("sub-title">.+?)(<\/div>)/, `$1<br>${html_data.join('\n')}$2`)

    $done({ body })

}

douban_addons()
