fetch('https://www.w3.org/TR/tr-groups-all')
    .then(res => res.text())
    .then(resText => {
        var domParser = new DOMParser();
        var dom = domParser.parseFromString(resText, 'text/html');
        console.log(WebIDLParse(dom));
    })
    .catch(ex => console.log('fetch error', ex));