// let refreshBtn = document.getElementById("refresh");
columnIdToStatus = {
    "10000": { 'text': '待办', 'class': 'label-danger' },
    "3": { 'text': '开发中', 'class': 'label-warning' },
    "10004": { 'text': '已提测', 'class': 'label-info' },
    "10005": { 'text': '测试中', 'class': 'label-success' },
}

async function initContentScript() {
    let [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['jquery-1.8.3.js', 'contentScript.js']
    });
}

async function initData() {
    let [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    console.log('current tab', tab);
    let url = tab.url;
    if (url.indexOf('?') === -1) {
        return;
    }
    const urlParams = new URLSearchParams(url.split('?')[1]);
    const rapidViewId = urlParams.get('rapidView')
    const selectedProjectKey = urlParams.get('projectKey')
    let activeQuickFilters = urlParams.getAll('quickFilter')
    if (!rapidViewId || !selectedProjectKey) {
        return;
    }
    if (activeQuickFilters == null) {
        activeQuickFilters = []
    }
    let filterUrlParamsStr = '';
    if (activeQuickFilters.length != 0) {
        console.log(activeQuickFilters)
        activeQuickFilters.forEach(filter => filterUrlParamsStr += '&activeQuickFilters=' + filter)
    }

    const pmsDomain = await chrome.storage.sync.get('pmsDomain')
    if(!pmsDomain.pmsDomain) {
        $('#tips').html('请在插件图标上右键”选项“中设置Jira域名后使用。')
        return;
    }
    const allData = await fetch(pmsDomain.pmsDomain + '/rest/greenhopper/1.0/xboard/work/allData.json?rapidViewId=' + rapidViewId + '&selectedProjectKey=' + selectedProjectKey + filterUrlParamsStr + '&_=' + Date.now())
        .then(resp => resp.json())
        .catch(error => null);
    console.log('allData', allData)
    if (!allData.issuesData || !allData.issuesData.issues) {
        return;
    }

    let issues = allData.issuesData.issues;
    let devStoryPointSum = {};
    let devStoryPointDetail = {};
    let emptyStoryPointCount = 0;
    let emptyStoryPointKeys = []
    let issueIdsExceptTestingPassed = []
    issues.forEach(function (issue) {
        if (issue.statusId == '10006') {
            return;
        }
        issueIdsExceptTestingPassed.push(issue.id)

        let issueTitle = issue.summary;
        let devUsername = issue.extraFields[0].html
        let storyPoint = issue.estimateStatistic.statFieldValue.value
        if (storyPoint == undefined) {
            emptyStoryPointCount++;
            emptyStoryPointKeys.push(issue.key);
            return;
        }
        if (!devUsername || storyPoint == 0) {
            return;
        }
        if (!devStoryPointSum[devUsername]) {
            devStoryPointSum[devUsername] = storyPoint
        } else {
            devStoryPointSum[devUsername] += storyPoint
        }
        if (!devStoryPointDetail[devUsername]) {
            devStoryPointDetail[devUsername] = []
        }
        let status = columnIdToStatus[issue.statusId];
        let className = "label-info";
        let statusText = issue.statusName;
        if (status != null) {
            className = status.class;
            statusText = status.text
        }
        devStoryPointDetail[devUsername].push('<span class="label ' + className + '">' + statusText + '</span> ' + issueTitle + ': ' + storyPoint)
    })

    if (emptyStoryPointCount > 0) {
        chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
            chrome.tabs.sendMessage(tabs[0].id, { command: "HIGHLIGHT_EMPTY_STORY_POINT", issueKeys: emptyStoryPointKeys });
        });
        $('#tips').html('其中有 ' + emptyStoryPointCount + ' 个单子未设置研发工作量，已高亮背景显示')
    }
    renderDev({ devStoryPointSum, devStoryPointDetail })
    renderTester({ issueIdsExceptTestingPassed })
}

function getFieldValueFromIssueDetail(issueDetail, fieldName) {
    let field = issueDetail.fields.find(function (field) {
        return field.id == fieldName;
    });
    if (!field) {
        return null;
    }
    return $(field.editHtml).find('#' + fieldName).val();;
}

async function renderTester(request) {
    const issueIdsExceptTestingPassed = request.issueIdsExceptTestingPassed;

    let issueDetails = []

    const pmsDomain = await chrome.storage.sync.get('pmsDomain');
    Promise.all(issueIdsExceptTestingPassed.map(issueId =>
        fetch(pmsDomain.pmsDomain + "/secure/AjaxIssueEditAction!default.jspa?decorator=none&issueId=" + issueId + "&_=" + Date.now()).then(resp => resp.json())
    )).then(issueDetails => {
        console.log('resp issueDetails', issueDetails)

        let testerStoryPointSum = {}
        let testerStoryPointDetail = {}
        issueDetails.forEach(function (issueDetail) {
            let issueTitle = getFieldValueFromIssueDetail(issueDetail, 'summary');
            let testerUsername = getFieldValueFromIssueDetail(issueDetail, 'customfield_10014');
            let storyPoint = parseFloat(getFieldValueFromIssueDetail(issueDetail, 'customfield_32901'));
            if (isNaN(storyPoint)) {
                storyPoint = 0;
            }
            if (!testerUsername || storyPoint == 0) {
                return;
            }
            if (!testerStoryPointSum[testerUsername]) {
                testerStoryPointSum[testerUsername] = storyPoint
            } else {
                testerStoryPointSum[testerUsername] += storyPoint
            }
            if (!testerStoryPointDetail[testerUsername]) {
                testerStoryPointDetail[testerUsername] = []
            }
            testerStoryPointDetail[testerUsername].push(issueTitle + ': ' + storyPoint)
        });

        console.log('testerStoryPointSum', testerStoryPointSum, 'testerStoryPointDetail', testerStoryPointDetail)
        if (testerStoryPointSum.length === 0) {
            $('#testerResultTbody').html('No result.')
        } else {
            let tbody = ''

            Object.keys(testerStoryPointSum).forEach(function (testerUsername) {
                let detailHtml = '<ul style="list-style-type: none;margin-bottom:0;">';
                testerStoryPointDetail[testerUsername].forEach(function (el) {
                    detailHtml += '<li>' + el + '</li>'
                })
                detailHtml += '</ul>'
                tbody += '<tr><td>' + testerUsername + '</td><td>' + testerStoryPointSum[testerUsername] + '</td><td>' + detailHtml + '</td></tr>'
            })

            $('#testerResultTbody').html(tbody)
        }
    })
}

function renderDev(request) {
    let devStoryPointSum = request.devStoryPointSum;
    let devStoryPointDetail = request.devStoryPointDetail;

    if (devStoryPointSum.length === 0) {
        $('#devResultTbody').html('No result.')
    } else {
        let tbody = ''

        Object.keys(devStoryPointSum).forEach(function (devUsername) {
            let detailHtml = '<ul style="list-style-type: none;margin-bottom:0;">';
            devStoryPointDetail[devUsername].forEach(function (el) {
                detailHtml += '<li>' + el + '</li>'
            })
            detailHtml += '</ul>'
            tbody += '<tr><td>' + devUsername + '</td><td>' + devStoryPointSum[devUsername] + '</td><td>' + detailHtml + '</td></tr>'
        })

        $('#devResultTbody').html(tbody)
    }
}

initContentScript();
initData();