let defaultStoryPointFieldName = ""

chrome.runtime.onInstalled.addListener(() => {
    let storyPointFieldName = chrome.storage.sync.get('storyPointFieldName') || defaultStoryPointFieldName;

    chrome.storage.sync.set({ storyPointFieldName });
    chrome.storage.sync.set({ color: 'red' });
    console.log('Story point filed name set to %cgreen', `${storyPointFieldName}`);
});