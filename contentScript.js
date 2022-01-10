chrome.runtime.onMessage.addListener(
    function (request, sender, sendResponse) {
        if (request.command === "HIGHLIGHT_EMPTY_STORY_POINT") {
            let issueKeys = request.issueKeys;
            issueKeys.forEach(function (issueKey) {
                document.querySelector('[data-issue-key="' + issueKey + '"]').style.backgroundColor = '#eedeb0';
            })
        }
    }
);