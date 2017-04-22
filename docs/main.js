fetch('https://www.w3.org/TR/webrtc/')
    .then(res => res.text())
    .then(resText => {
        var domParser = new DOMParser();
        var dom = domParser.parseFromString(resText, 'text/html');
        var legacySection = dom.getElementById('legacy-interface-extensions');
        legacySection.parentElement.removeChild(legacySection);
        console.clear();
        var data = WebIDLParse(dom, false);
        //convertToCSData(data);
        console.log(JSON.stringify(data, null, 4));
    })
    .catch(ex => console.log('fetch error', ex));