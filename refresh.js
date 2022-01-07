$body = $(document.body)

columnIdToStatus = {
    3419: { 'text': '待办', 'class': 'label-danger' },
    3420: { 'text': '开发中', 'class': 'label-warning' },
    3425: { 'text': '已提测', 'class': 'label-info' },
    3429: { 'text': '测试中', 'class': 'label-success' },
}

userStoryPointSum = {};
userStoryPointDetail = {};
emptyStoryPointCount = 0;

$('#resultTbody').html('Querying...')

$body.find('.ghx-swimlane .ghx-column').each(function (index, el) {
    let columnId = $(el).data('column-id')
    if (columnId == 3807) {
        return;
    }
    $(el).find('.js-issue').each(function (index, el) {
        let $el = $(el)
        let $parent = $el.parent('.ghx-column')
        let columnId = $parent.data('column-id')

        let issueTitle = $el.find('.ghx-inner').text()
        let storyPoint = parseFloat($el.find('.ghx-corner').text())
        if (isNaN(storyPoint)) {
            emptyStoryPointCount += 1;
            console.log('isNaN')
            // $el.stop().animate({backgroundColor: '#ff0000'})
            $el.css('background', '#eedeb0')
            // $el.css('width', '300px')
            storyPoint = 0
        }
        let devUsername = $el.find('.ghx-extra-field-content').first().text()

        console.log(issueTitle, devUsername, storyPoint)

        if (devUsername && storyPoint > 0) {
            if (!userStoryPointSum[devUsername]) {
                userStoryPointSum[devUsername] = storyPoint
            } else {
                userStoryPointSum[devUsername] += storyPoint
            }
            if (!userStoryPointDetail[devUsername]) {
                userStoryPointDetail[devUsername] = []
            }
            let status = columnIdToStatus[columnId]
            userStoryPointDetail[devUsername].push('<span class="label ' + status.class + '">' + status.text + '</span> ' + issueTitle + ': ' + storyPoint)
        }
    })
})

console.log('userStoryPointSum', userStoryPointSum, 'userStoryPointDetail', userStoryPointDetail)

chrome.runtime.sendMessage({
    userStoryPointSum,
    userStoryPointDetail,
    emptyStoryPointCount
});