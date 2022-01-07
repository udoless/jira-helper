// let refreshBtn = document.getElementById("refresh");

async function refresh() {
    let [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['jquery-1.8.3.js', 'refresh.js']
    });
}

// When the button is clicked, inject setPageBackgroundColor into current page
// refreshBtn.addEventListener("click", refresh);
chrome.runtime.onMessage.addListener(
    function (request, sender, sendResponse) {
        let userStoryPointSum = request.userStoryPointSum;
        let userStoryPointDetail = request.userStoryPointDetail;
        let emptyStoryPointCount = request.emptyStoryPointCount;

        console.log('received', userStoryPointSum, userStoryPointDetail)

        if (userStoryPointSum.length === 0) {
            $('#resultTbody').html('No result.')
        } else {
            let tbody = ''

            Object.keys(userStoryPointSum).forEach(function (devUsername) {
                let detailHtml = '<ul style="list-style-type: none;margin-bottom:0;">';
                userStoryPointDetail[devUsername].forEach(function (el) {
                    detailHtml += '<li>' + el + '</li>'
                })
                detailHtml += '</ul>'
                tbody += '<tr><td>' + devUsername + '</td><td>' + userStoryPointSum[devUsername] + '</td><td>' + detailHtml + '</td></tr>'
            })

            $('#resultTbody').html(tbody)
        }

        if (emptyStoryPointCount > 0) {
            $('#tips').html('其中有 ' + emptyStoryPointCount + ' 个单子未设置工作量，已高亮背景显示')
        }
    }
);


refresh();