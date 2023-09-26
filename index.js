// let refreshBtn = document.getElementById("refresh");
columnIdToStatus = {
    "10000": { 'text': '待办', 'class': 'label-danger' },
    "3": { 'text': '开发中', 'class': 'label-warning' },
    "10004": { 'text': '已提测', 'class': 'label-info' },
    "10005": { 'text': '测试中', 'class': 'label-success' },
}
$('#dev .nav-tabs a').click(function (e) {
    e.preventDefault()
    let tabId = $(this).attr('aria-controls')

    $('#dev .nav-tabs li').removeClass('active')
    $(this).parent('li').addClass('active')

    $('#dev .tab-pane').removeClass('active')
    $('#dev .tab-pane#' + tabId).addClass('active')
    chrome.storage.sync.set({
        lastViewedTabId: tabId
    });
})

async function initContentScript() {
    let [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['contentScript.js']
    });
}

async function initData() {
    const pmsDomain = await chrome.storage.sync.get('pmsDomain')
    if (!pmsDomain.pmsDomain) {
        $('#tips').html('请在插件图标上右键”选项“中设置 Jira域名 后使用。')
        return;
    }
    const lastViewedTabId = await chrome.storage.sync.get('lastViewedTabId')
    if (lastViewedTabId.lastViewedTabId) {
        $('#dev .nav-tabs a[aria-controls="' + lastViewedTabId.lastViewedTabId + '"]').click()
    }

    let [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    console.log('current tab', tab);
    let url = tab.url;
    if (url.indexOf('?') === -1) {
        return;
    }
    const urlParams = new URLSearchParams(url.split('?')[1]);
    const rapidViewId = urlParams.get('rapidView')
    let selectedProjectKey = urlParams.get('projectKey')
    let activeQuickFilters = urlParams.getAll('quickFilter')
    if (!selectedProjectKey) {
        const projectKey = await chrome.storage.sync.get('projectKey')
        if (!projectKey.projectKey) {
            $('#tips').html('请在插件图标上右键"选项"中设置 项目Key 后使用。')
            return;
        }
        console.log('projectKey', projectKey.projectKey)
        selectedProjectKey = projectKey.projectKey
    }
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

    const allData = await fetch(pmsDomain.pmsDomain + '/rest/greenhopper/1.0/xboard/work/allData.json?rapidViewId=' + rapidViewId + '&selectedProjectKey=' + selectedProjectKey + filterUrlParamsStr + '&_=' + Date.now())
        .then(resp => resp.json())
        .catch(error => null);
    console.log('allData', allData)
    if (!allData.issuesData || !allData.issuesData.issues) {
        return;
    }

    let issues = allData.issuesData.issues;
    let issueIdsExceptTestingPassed = []
    let issueIdToStatusEle = {}
    issues.forEach(function (issue) {
        if (issue.statusId == '10006') {
            return;
        }
        issueIdsExceptTestingPassed.push(issue.id)

        let status = columnIdToStatus[issue.statusId];
        let className = "label-info";
        let statusText = issue.statusName;
        if (status != null) {
            className = status.class;
            statusText = status.text
        }
        issueIdToStatusEle[issue.id] = '<span class="label ' + className + '">' + statusText + '</span>';
    })


    renderDev({ issues, issueIdToStatusEle })

    let issuesExceptTestingPassedArr = await Promise.all(issueIdsExceptTestingPassed.map(issueId =>
        fetch(pmsDomain.pmsDomain + "/secure/AjaxIssueEditAction!default.jspa?decorator=none&issueId=" + issueId + "&_=" + Date.now()).then(resp => resp.json())
    ));
    let i = 0;
    let issuesExceptTestingPassed = {}
    issueIdsExceptTestingPassed.map(issueId => {
        issuesExceptTestingPassed[issueId] = issuesExceptTestingPassedArr[i++];
    });
    console.log('issuesExceptTestingPassed', issuesExceptTestingPassed)

    renderTester({ issuesExceptTestingPassed, issueIdToStatusEle })
    renderComponent({ issuesExceptTestingPassed, issueIdToStatusEle })
}

function getFieldValueFromIssueDetail(issueDetail, fieldName, type = 'input') {
    let field = issueDetail.fields.find(function (field) {
        return field.id == fieldName;
    });
    if (!field) {
        return null;
    }
    if (type == 'input') {
        return $(field.editHtml).find('#' + fieldName).val();
    } else if (type == 'select') {
        return $(field.editHtml).find('#' + fieldName).children('option:selected').text();
    }
    return null;
}

async function renderComponent(request) {
    let issuesExceptTestingPassed = request.issuesExceptTestingPassed

    let componentStoryPointSum = {}
    let componentStoryPointDetail = {}
    for (const [issueId, issueDetail] of Object.entries(issuesExceptTestingPassed)) {
        let issueTitle = getFieldValueFromIssueDetail(issueDetail, 'summary');
        let componentName = getFieldValueFromIssueDetail(issueDetail, 'components', 'select');
        let storyPoint = parseFloat(getFieldValueFromIssueDetail(issueDetail, 'customfield_10006'));
        if (!componentStoryPointDetail[componentName]) {
            componentStoryPointDetail[componentName] = []
        }
        if (isNaN(storyPoint)) {
            componentStoryPointDetail[componentName].push(request.issueIdToStatusEle[issueId] + ' ' + issueTitle + ': ?')
            continue;
        }
        if (!componentName || storyPoint == 0) {
            continue;
        }
        if (!componentStoryPointSum[componentName]) {
            componentStoryPointSum[componentName] = storyPoint
        } else {
            componentStoryPointSum[componentName] += storyPoint
        }
        
        componentStoryPointDetail[componentName].push(request.issueIdToStatusEle[issueId] + ' ' + issueTitle + ': ' + storyPoint)
    }

    if (componentStoryPointSum.length === 0) {
        $('#componentResultTbody').html('No result.')
    } else {
        let tbody = ''

        Object.keys(componentStoryPointSum).forEach(function (componentName) {
            let detailHtml = '<ul style="list-style-type: none;margin-bottom:0;">';
            componentStoryPointDetail[componentName].forEach(function (el) {
                detailHtml += '<li>' + el + '</li>'
            })
            detailHtml += '</ul>'
            tbody += '<tr><td>' + componentName + '</td><td>' + componentStoryPointSum[componentName] + '</td><td>' + detailHtml + '</td></tr>'
        })

        $('#componentResultTbody').html(tbody)
    }
}


async function renderTester(request) {
    let issuesExceptTestingPassed = request.issuesExceptTestingPassed

    let testerStoryPointSum = {}
    let testerStoryPointDetail = {}
    for (const [issueId, issueDetail] of Object.entries(issuesExceptTestingPassed)) {
        let issueTitle = getFieldValueFromIssueDetail(issueDetail, 'summary');
        let testerUsername = getFieldValueFromIssueDetail(issueDetail, 'customfield_10014');
        let storyPoint = parseFloat(getFieldValueFromIssueDetail(issueDetail, 'customfield_32901'));
        if (isNaN(storyPoint)) {
            storyPoint = 0;
        }
        if (!testerUsername || storyPoint == 0) {
            continue;
        }
        if (!testerStoryPointSum[testerUsername]) {
            testerStoryPointSum[testerUsername] = storyPoint
        } else {
            testerStoryPointSum[testerUsername] += storyPoint
        }
        if (!testerStoryPointDetail[testerUsername]) {
            testerStoryPointDetail[testerUsername] = []
        }
        testerStoryPointDetail[testerUsername].push(request.issueIdToStatusEle[issueId] + ' ' + issueTitle + ': ' + storyPoint)
    }

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
}

function renderDev(request) {
    let devStoryPointSum = {};
    let devStoryPointDetail = {};
    let emptyStoryPointCount = 0;
    let emptyStoryPointKeys = []
    request.issues.forEach(function (issue) {
        if (issue.statusId == '10006') {
            return;
        }

        let issueTitle = issue.summary;
        let devUsername = issue.extraFields[0].html
        let storyPoint = issue.estimateStatistic.statFieldValue.value
        if (!devStoryPointDetail[devUsername]) {
            devStoryPointDetail[devUsername] = []
        }
        if (storyPoint == undefined) {
            emptyStoryPointCount++;
            emptyStoryPointKeys.push(issue.key);
            if(devUsername){
                devStoryPointDetail[devUsername].push(request.issueIdToStatusEle[issue.id] + ' ' + issueTitle + ': ?')
            }
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
        
        devStoryPointDetail[devUsername].push(request.issueIdToStatusEle[issue.id] + ' ' + issueTitle + ': ' + storyPoint)
    })

    if (emptyStoryPointCount > 0) {
        chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
            chrome.tabs.sendMessage(tabs[0].id, { command: "HIGHLIGHT_EMPTY_STORY_POINT", issueKeys: emptyStoryPointKeys });
        });
        $('#tips').html('其中有 ' + emptyStoryPointCount + ' 个单子未设置研发工作量，已高亮背景显示')
    }

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