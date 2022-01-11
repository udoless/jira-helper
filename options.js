function save_options() {
  var pmsDomain = document.getElementById('pms-domain').value;
  var projectKey = document.getElementById('project-key').value;
  chrome.storage.sync.set({
    pmsDomain: pmsDomain,
    projectKey: projectKey
  }, function () {
    // Update status to let user know options were saved.
    var status = document.getElementById('status');
    status.textContent = 'Options saved.';
    setTimeout(function () {
      status.textContent = '';
    }, 750);
  });
}

// Restores select box and checkbox state using the preferences
// stored in chrome.storage.
function restore_options() {
  // Use default value color = 'red' and likesColor = true.
  chrome.storage.sync.get({
    pmsDomain: ''
  }, function (items) {
    document.getElementById('pms-domain').value = items.pmsDomain;
  });
  chrome.storage.sync.get({
    projectKey: ''
  }, function (items) {
    document.getElementById('project-key').value = items.projectKey;
  });
}
document.addEventListener('DOMContentLoaded', restore_options);
document.getElementById('save').addEventListener('click',
  save_options);