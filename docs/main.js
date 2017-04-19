fetch('https://www.w3.org/TR/webrtc/')
    .then(res => res.text())
    .then(resText => {
        var domParser = new DOMParser();
        var dom = domParser.parseFromString(resText, 'text/html');
        console.clear();
        console.log(JSON.stringify(WebIDLParse(dom), null, 4));
    })
    .catch(ex => console.log('fetch error', ex));