const keys = require('./keys');
const https = require("https");
const fetch = require("node-fetch");
const fs = require('fs');

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

async function getStaticMap(latitude, longitude) {
    let query = `https://maps.googleapis.com/maps/api/staticmap?center=${latitude},${longitude}&zoom=12&size=400x400&key=${keys.GOOGLE_MAPS_API_KEY}`;
    try {
        const response = await fetch(query);
        console.log(response);
        response.pipe(fs.createWriteStream('test.png'));
    } catch(error) {
        console.log(`>> getStaticMap(): ${error}`);
        return {
            'status': 'failed',
            'payload': {}
        }
    }
}

async function placeSearch(placeName) {
    let query = `https://maps.googleapis.com/maps/api/geocode/json?address=${placeName}&key=${keys.GOOGLE_MAPS_API_KEY}`;

    try {
        const response = await fetch(query);
        const json = await response.json();

        console.log(json.results[0].geometry.bounds);

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

async function randomStreetView(ne_x, ne_y, sw_x, sw_y) {
    /*
        Generates a random StreetView image in a given rectangle of coordinates
        { northeast: { lat: 49.4976831, lng: 32.140585 },
          southwest: { lat: 49.364583, lng: 31.9578749 } }
    */
    let randLat = (Math.random() * Math.abs(Math.round(ne_x*1000000) - Math.round(sw_x*1000000)))/1000000 + Math.min(ne_x, sw_x);
    let randLng = (Math.random() * Math.abs(Math.round(ne_y*1000000) - Math.round(sw_y*1000000)))/1000000 + Math.min(ne_y, sw_y);
    console.log(`random latitude (between ${ne_y} and ${sw_y}): ${randLng}`);
    console.log(`random latitude (between ${ne_x} and ${sw_x}): ${randLat}`);

    let query = `https://maps.googleapis.com/maps/api/streetview?size=400x400&location=${randLat},${randLng}&key=${keys.GOOGLE_MAPS_API_KEY}`;
    console.log(query);
    // https://maps.googleapis.com/maps/api/streetview?size=400x400&location=${randLat},${randLng}&heading=151.78&pitch=-0.76&key=YOUR_API_KEY&signature=YOUR_SIGNATURE

    try {
        const response = await fetch(query);
        const json = await response.json();

        //console.log(JSON.stringify(response));

        if (json.status !== 'OK') {
            return {
                'status': 'failed',
                'payload': {}
            }
        } else {
            return {
                'status': 'ok',
                'payload': {

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

randomStreetView(49.4976831, 32.140585, 49.364583, 31.9578749);