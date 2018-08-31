async function placeSearch(placeName) {
    let query = `https://maps.googleapis.com/maps/api/geocode/json?address=${placeName}&key=${GOOGLE_MAPS_API_KEY}`;

    try {
        const response = await fetch(query);
        const json = await response.json();

        if (json.status !== 'OK') {
            return {
                'status': 'failed',
                'payload': {}
            }
        } else {
            console.log('##################');
            console.log(JSON.stringify(json.results[0]));
            return {
                'status': 'ok',
                'payload': {
                    'city': json.results[0].formatted_address,
                    'latitude': json.results[0].geometry.location.lat,
                    'longitude': json.results[0].geometry.location.lng,
                    'bounds': json.results[0].geometry.bounds // { northeast: { lat: 49.4976831, lng: 32.140585 }, southwest: { lat: 49.364583, lng: 31.9578749 } }
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
    */
    for (let i=0; i<50; i++){ // let's make not more than 50 requests in sequence ;)
        let randLat = (Math.random() * Math.abs(Math.round(ne_x*1000000) - Math.round(sw_x*1000000)))/1000000 + Math.min(ne_x, sw_x);
        let randLng = (Math.random() * Math.abs(Math.round(ne_y*1000000) - Math.round(sw_y*1000000)))/1000000 + Math.min(ne_y, sw_y);

        let metadataQuery = `https://maps.googleapis.com/maps/api/streetview/metadata?size=${params.imageWidth}x${params.imageHeight}&location=${randLat},${randLng}&key=${GOOGLE_MAPS_API_KEY}`;
        let imageQuery = `https://maps.googleapis.com/maps/api/streetview?size=${params.imageWidth}x${params.imageHeight}&location=${randLat},${randLng}&key=${GOOGLE_MAPS_API_KEY}`;
        // To limit images to outdoors only
        //let imageQuery = `https://maps.googleapis.com/maps/api/streetview?size=${params.imageWidth}x${params.imageHeight}&source=outdoor&location=${randLat},${randLng}&key=${GOOGLE_MAPS_API_KEY}`;
        //let webMap = `https://www.google.com/maps/@${randLat},${randLng},14z`; // for testing

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


async function getStreetView(lat, lng, heading=false) {
    /*
        Fetches a Google Street View image for given lat/lng and optionally for a random heading
    */
    let imageQuery = '';
    if (!heading) {
        imageQuery = `https://maps.googleapis.com/maps/api/streetview?size=${params.imageWidth}x${params.imageHeight}&location=${lat},${lng}&key=${GOOGLE_MAPS_API_KEY}`;
    } else {
        let randHeading = Math.random() * 360;
        imageQuery = `https://maps.googleapis.com/maps/api/streetview?size=${params.imageWidth}x${params.imageHeight}&location=${lat},${lng}&heading=${randHeading}&key=${GOOGLE_MAPS_API_KEY}`;
    }

    try {
        const response = await fetch(imageQuery);
        const json = await response.json();

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


function distanceBetweenMarkers(lat1, lon1, lat2, lon2) {
    /*
        Calculate distance between two coordinates using Haversine formula
        // https://stackoverflow.com/questions/27928/calculate-distance-between-two-latitude-longitude-points-haversine-formula/27943#27943
    */
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
    /*
        Helper function for distanceBetweenMarkers()
    */
    return deg * (Math.PI/180);
}


async function getQuery(q) {
    /*
        Sending queries to our PostgreSQL DB
    */
    console.log('getQuery!');
    try {
        const { Client } = require('pg');

        // Credentials for AWS
        const user = "iuriidMaster";
        const host = "guesstheplace.cchwc62hzris.us-east-1.rds.amazonaws.com";
        const database = "users";
        const dbPort = 5432;

        // Credentials for local machine
        /*
        const user = "postgres";
        const host = "localhost";
        const database = "guesstheplace";
        const dbPort = 5432;
        */

        const client = new Client({
            user: process.env.rdsUserName,
            host: process.env.rdsHostName,
            database: process.env.rdsDB,
            password: process.env.postgreSQLKey,
            port: process.env.rdsPort,
            ssl: true
        });

        client.defaults.ssl = true;

        client.connect(function(err) {
            if (err) {
                console.error('Database connection failed: ' + err.stack);
                return;
            }
            console.log('Connected to database.');
        });

        let ourQuery = await client.query(q);
        console.log(JSON.stringify(ourQuery));
        client.end();
        return JSON.stringify(ourQuery);
    } catch (e) {
        console.log(`Ups from getQuery(): ${e}`);
        return false;
    }
}


async function scoresUpdate(usersTable, userId, score) {
    try {
        /*
        let q = `SELECT top_score FROM ${usersTable} WHERE telegram_id=${userId}`;
        let dbResponse = await getQuery(q);
        let dbResponseParsed = JSON.parse(dbResponse);
        console.log(`This one: ${JSON.stringify(dbResponseParsed)}`);

        if (dbResponseParsed.rows[0]['top_score']===null || (dbResponseParsed.rows[0]['top_score']!==null && dbResponse.rows[0]['top_score']<score)) {
            q = `UPDATE ${usersTable} SET last_score=${score}, top_score=${score} WHERE telegram_id=${userId};`;
        } else {
            q = `UPDATE ${usersTable} SET last_score=${score} WHERE telegram_id=${userId};`;
        }

        dbResponse = await getQuery(q);
        dbResponseParsed = JSON.parse(dbResponse);
        console.log(`That one: ${JSON.stringify(dbResponseParsed)}`);
        */
        let q = `UPDATE ${usersTable} SET last_score=${score} WHERE telegram_id=${userId};`;
        await getQuery(q);
    } catch (e) {
        console.log(`Ups from scoresUpdate(): ${e}`);
        return false;
    }
}