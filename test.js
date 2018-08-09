const keys = require('./keys');
const https = require("https");
const fetch = require("node-fetch");

function placeSearch2(placeName) {
    /*
        Function takes a placeName (string) or coordinates ({"lat": float, "long": float}) and searches
        for a city-province/state-country
     */
    let query = `https://maps.googleapis.com/maps/api/place/findplacefromtext/json?input=${placeName}&inputtype=textquery&fields=formatted_address,geometry,place_id&key=${keys.GOOGLE_MAPS_API_KEY}`;
    let query1 = `https://maps.googleapis.com/maps/api/geocode/json?address=${placeName}&key=${keys.GOOGLE_MAPS_API_KEY}`;

    https.get(query1, res => {
        res.setEncoding("utf8");
        let body = "";
        res.on("data", data => {
            body += data;
        });
        res.on("end", () => {
            body = JSON.parse(body);
            return
            console.log(
                `City: ${body.results[0].formatted_address} -`,
                `Latitude: ${body.results[0].geometry.location.lat} -`,
                `Longitude: ${body.results[0].geometry.location.lng}`
            );
        });
    });
}


function placeSearch1(placeName) {
    /*
        Function takes a placeName (string) or coordinates ({"lat": float, "long": float}) and searches
        for a city-province/state-country
     */
    let query = `https://maps.googleapis.com/maps/api/geocode/json?address=${placeName}&key=${keys.GOOGLE_MAPS_API_KEY}`;

    const getLocation = async url => {
        try {
            const response = await fetch(query);
            const json = await response.json();
            console.log(
                `City: ${json.results[0].formatted_address} -`,
                `Latitude: ${json.results[0].geometry.location.lat} -`,
                `Longitude: ${json.results[0].geometry.location.lng}`
            );
        } catch (error) {
            console.log(error);
        }
    };
}


async function placeSearch(placeName) {
    let query = `https://maps.googleapis.com/maps/api/geocode/json?address=${placeName}&key=${keys.GOOGLE_MAPS_API_KEY}`;

    try {
        const response = await fetch(query);
        const json = await response.json();

        if (json.status !== 'OK') {
            return {
                'status': 'failed',
                'payload': {}
            }
        } else {
            return {
                'status': 'ok',
                'payload': {
                    'city': json.results[0].formatted_address,
                    'latitude': json.results[0].geometry.location.lat,
                    'longitude': json.results[0].geometry.location.lng
                }
            }
        }
    } catch(error) {
        console.log(`>> placeSearch(): ${error}`);
        return {
            'status': 'failed',
            'payload': {}
        }
    }
}

placeSearch2('kiev').then(data => {console.log(data)});