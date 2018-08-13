const keys = require('./keys');
const params = require('./parameters');
const https = require("https");
const fetch = require("node-fetch");
const fs = require('fs');
/*
function placeSearch2(placeName) {
    /*
        Function takes a placeName (string) or coordinates ({"lat": float, "long": float}) and searches
        for a city-province/state-country
     *//*
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
     *//*
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
        { northeast: { lat: 49.4976831, lng: 32.140585 }, southwest: { lat: 49.364583, lng: 31.9578749 } }
    *//*
    for (let i=0; i<50; i++){ // let's make not more than 50 requests in sequence ;)
        let randLat = (Math.random() * Math.abs(Math.round(ne_x*1000000) - Math.round(sw_x*1000000)))/1000000 + Math.min(ne_x, sw_x);
        let randLng = (Math.random() * Math.abs(Math.round(ne_y*1000000) - Math.round(sw_y*1000000)))/1000000 + Math.min(ne_y, sw_y);

        let metadataQuery = `https://maps.googleapis.com/maps/api/streetview/metadata?size=400x400&location=${randLat},${randLng}&key=${keys.GOOGLE_MAPS_API_KEY}`;
        let imageQuery = `https://maps.googleapis.com/maps/api/streetview?size=400x400&location=${randLat},${randLng}&key=${keys.GOOGLE_MAPS_API_KEY}`;
        let webMap = `https://www.google.com/maps/@${randLat},${randLng},14z`; // for testing

        /*
        console.log(i);
        console.log('metadataQuery:');
        console.log(metadataQuery);
        console.log('imageQuery:');
        console.log(imageQuery);
        console.log('webMap:');
        console.log(webMap);
        console.log();
        *//*

        try {
            const response = await fetch(metadataQuery);
            const json = await response.json();
            console.log(i);

            if (json.status === 'OK') {
                return {
                    'status': 'ok',
                    'payload': {
                        'image': imageQuery,
                        'exactLocation': {
                            'lat': json.location.lat,
                            'lng': json.location.lng
                        }
                    }
                }
            }
        } catch(error) {
            console.log(`>> randomStreetView(): ${error}`);
            return {
                'status': 'failed',
                'payload': {}
            }
        }
    }

    // In case we failed to find something in 50 queries..
    return {
        'status': 'failed',
        'payload': {}
    }
}

randomStreetView(49.4976831, 32.140585, 49.364583, 31.9578749).then(data => {
    if (data.status === 'ok') {
        console.log(data.payload.image);
    } else {
        console.log('Failed to get a street view');
    }

});

function distanceBetweenMarkers(lat1, lon1, lat2, lon2) {
    /*
        Calculate distance between two coordinates using Haversine formula
        // https://stackoverflow.com/questions/27928/calculate-distance-between-two-latitude-longitude-points-haversine-formula/27943#27943
        Actual location: {"lat":49.48476500248736,"lng":31.99574963103022}, your guess: {"latitude":49.456448,"longitude":32.046515
    *//*
        const R = 6371; // Radius of the earth in km
        let dLat = deg2rad(lat2-lat1);  // deg2rad below
        let dLon = deg2rad(lon2-lon1);
        let a =
            Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
            Math.sin(dLon/2) * Math.sin(dLon/2)
        ;
        let c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        let d = R * c; // Distance in km
        return d;
    }

function deg2rad(deg) {
        return deg * (Math.PI/180);
}
    // Actual location: {"lat":49.48476500248736,"lng":31.99574963103022}, your guess: {"latitude":49.456448,"longitude":32.046515
*/


async function getQuery(q) {
    /*
        Sending queries to our PostgreSQL DB
    */
    try {
        const { Client } = require('pg');

        // Credentials for AWS
        /*
        const user = "iuriidMaster";
        const host = "guesstheplacedb.cchwc62hzris.us-east-1.rds.amazonaws.com";
        const database = "guesstheplacedb";
        const dbPort = 5432;
        */

        // Credentials for local machine
        const user = "postgres";
        const host = "localhost";
        const database = "guesstheplace";
        const dbPort = 5432;

        const client = new Client({
            user: user,
            host: host,
            database: database,
            password: keys.postgreSQLKey,
            port: dbPort,
        });

        client.connect();

        let ourQuery = await client.query(q);
        //console.log(JSON.stringify(ourQuery, null, 2));
        client.end();
        return JSON.stringify(ourQuery);
    } catch (e) {
        console.log(`Ups.. ${e}`);
        return false;
    }
}

async function test(userId) {
    let q = `SELECT * FROM ${params.usersTable} WHERE telegram_id=${userId}`;
    let dbResponse = await getQuery(q);
    let dbResponseParsed = JSON.parse(dbResponse);
    console.log(dbResponseParsed.rows[0]);
}

test(178180819);
