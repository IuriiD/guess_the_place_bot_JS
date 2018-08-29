// Bot version using database - conversation state is saved to DB

// Commands registered via BotFather:
/*
/restart - Start a new game
/help - Get additional info
*/

// DB info
// Table 'users': CREATE TABLE users(telegram_id INT PRIMARY KEY, first_name TEXT, last_city TEXT, last_city_bounds JSON, last_score INT, top_score INT, should_be TEXT, exact_location JSON);
// INSERT INTO users(telegram_id, first_name, last_city, last_city_bounds, last_score, top_score) VALUES (178180819, 'Iurii', 'Cherkasy', '{"bounds":{"northeast":{"lat":49.4976831,"lng":32.140585},"southwest":{"lat":49.364583,"lng":31.9578749}}}', 12, 20, '', '{"lat":49.4976831,"lng":32.140585}');

'use strict';

const Telegraf = require('telegraf');
const Extra = require('telegraf/extra');
const Markup = require('telegraf/markup');
const fetch = require("node-fetch");

const params = require('./parameters');

// Production
const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY;
const bot = new Telegraf(process.env.TELEGRAM_TOKEN);

/*
// Development; long polling
const keys = require('./keys');
const GOOGLE_MAPS_API_KEY = keys.GOOGLE_MAPS_API_KEY;
const bot = new Telegraf(keys.TELEGRAM_TOKEN);
*/
// --------------------- Conversation logic ------------------------------------------------------------------------- //
bot.command(['start', 'restart'], async ctx => {
    const username = ctx.from.first_name;
    const userId = ctx.from.id;

    // Check if user is in our DB (at least clicked /start with the bot)
    let q = `SELECT * FROM ${params.usersTable} WHERE telegram_id=${userId}`;
    console.log(q);
    let dbResponse = await getQuery(q);
    let dbResponseParsed = JSON.parse(dbResponse);

    // User at least /start'ed with the bot and was saved in DB
    if (dbResponseParsed.rows.length>0 && dbResponseParsed.rows[0].count !== '0') {
        // If user earlier entered a city of interest - suggest it in a quick reply button
        if (dbResponseParsed.rows[0].last_city) {
            let lastCity = dbResponseParsed.rows[0].last_city;
            await ctx.replyWithHTML('To start please <b>type in a city</b>', Markup
                .keyboard([lastCity])
                .oneTime()
                .resize()
                .extra());
        // Otherwise - only suggest to enter city
        } else {
            await ctx.replyWithHTML('To start please <b>type in a city</b>');
        }

    // Completely new user
    } else {
        await ctx.replyWithHTML(`Hi, <b>${username}</b>! I'm a GuessThePlaceBot`);
        await ctx.replyWithHTML('Do you know your city well? \nWill you recognize a place by photo?');
        await ctx.replyWithHTML('To start please <b>type in a city</b>');

        // Add user to DB
        let q = `INSERT INTO ${params.usersTable}(telegram_id, first_name) VALUES(${userId}, '${username}');`;
        let dbResponse = await getQuery(q);
        let dbResponseParsed = JSON.parse(dbResponse);
        console.log(dbResponseParsed);
    }

    q = `UPDATE ${params.usersTable} SET should_be='choosing city' WHERE telegram_id=${userId};`;
    dbResponse = await getQuery(q);
    dbResponseParsed = JSON.parse(dbResponse);
    console.log(dbResponseParsed);
    });


bot.command(['help'], async ctx => {
    const username = ctx.from.first_name;

    await ctx.replyWithHTML(`Hey, <b>${username}</b>!\nThanks for trying @GuessThePlaceBot!\n\nHere's some info you may need:\n<b>/start, /restart</b> - Start a new game\n<b>Hint</b> - Get another photo from the same place but in another (random) direction (-${params.getHint})\n<b>Pass</b> - Skip the question (-${params.skipImage})`);
    await ctx.replyWithHTML('\nTo send location while answering a question (screenshots from iPhone):');
    await ctx.replyWithPhoto('https://iuriid.github.io/public/img/gtpb-how_to_send_location.png');
    await ctx.reply(`\n(c) Iurii Dziuban - August 2018\nConsider visiting my online-portfolio:`, Markup.inlineKeyboard([
            Markup.urlButton('iuriid.github.io', 'https://iuriid.github.io/'),
        ]).extra())
});


bot.on('message', async ctx => {
    console.log(ctx.message);

    const userId = ctx.from.id;

    // Check if user is in our DB (at least clicked /start with the bot)
    let q = `SELECT * FROM ${params.usersTable} WHERE telegram_id=${userId}`;
    let dbResponse = await getQuery(q);
    let dbResponseParsed = JSON.parse(dbResponse);

    // Temp
    if (dbResponseParsed) console.log('Here1');

    // User at least /start'ed with the bot and was saved in DB
    if (dbResponseParsed.rows.length>0 && dbResponseParsed.rows[0].count !== '0') {
        // Temp
        if (dbResponseParsed) console.log('Here2');

        let usersState = dbResponseParsed.rows[0]['should_be'];

        // If user only /start'ed (was suggested to choose a city):
        if (usersState === 'choosing city') {
            // Temp
            if (dbResponseParsed) console.log('Here3');
            let cityOfInterest = await placeSearch(ctx.update.message.text);

            // Check the city using GMaps API
            if (cityOfInterest.status === 'ok') {
                await ctx.replyWithPhoto(`https://maps.googleapis.com/maps/api/staticmap?language=en&region=US&center=${cityOfInterest.payload.latitude},${cityOfInterest.payload.longitude}&zoom=12&size=${params.imageWidth}x${params.imageHeight}&key=${GOOGLE_MAPS_API_KEY}`);

                // And confirm user's choice
                await ctx.replyWithHTML(`Do you mean <b>${cityOfInterest.payload.city}</b>?`, Markup
                    .keyboard(['Right!', 'No - I\'ll enter another one'])
                    .oneTime()
                    .resize()
                    .extra()
                );

                // Save user's choice (not confirmed yet) to DB and update state (from 'choosing city' to 'confirming city')
                let q = `UPDATE ${params.usersTable} SET last_city='${ctx.update.message.text}', last_city_bounds='{"bounds":${JSON.stringify(cityOfInterest.payload.bounds)}}', should_be='confirming city' WHERE telegram_id=${userId};`;
                let dbResponse = await getQuery(q);
                let dbResponseParsed = JSON.parse(dbResponse);
                console.log(dbResponseParsed);
            } else {
                await ctx.reply(`Sorry but I failed to determine what is "${ctx.update.message.text}". Could you please enter another city?`);
                // State is preserved 'choosing city'
            }

        // City entered by user was checked using GMaps Geocoding API, user was asked to confirm if we understood him/her correctly..
        } else if (usersState === 'confirming city') {
            // Temp
            if (dbResponseParsed) console.log('Here4');

            // .. and answered 'Right'
            if (ctx.update.message.text === 'Right!') {
                await ctx.replyWithHTML(`Ok, here we go ;)\n<b>Here are the rules:</b>\n- initial score: <b>${params.initialScore}</b>\n- skip image: <b>-${params.skipImage}</b>\n- get a hint: <b>-${params.getHint}</b>\n- poor answer: <b>-${params.poorAnswer}</b>\n- fair answer: <b>+${params.fairAnswer}</b>\n- good answer: <b>+${params.goodAnswer}</b>`);
                await ctx.replyWithHTML(`To indicate location please <b>SEND LOCATION</b> having dragged the marker to the needed place as shown below:`);
                await ctx.replyWithPhoto('https://iuriid.github.io/public/img/gtpb-how_to_send_location.png');

                // Get a random Street View image in a given coordinates square (stored in user's state)
                let neLat = dbResponseParsed.rows[0]['last_city_bounds']['bounds']['northeast']['lat'];
                let neLng = dbResponseParsed.rows[0]['last_city_bounds']['bounds']['northeast']['lng'];
                let swLat = dbResponseParsed.rows[0]['last_city_bounds']['bounds']['southwest']['lat'];
                let swLng = dbResponseParsed.rows[0]['last_city_bounds']['bounds']['southwest']['lng'];
                let streetView = await randomStreetView(neLat, neLng, swLat, swLng);

                if (streetView.status === 'ok') {
                    await ctx.reply('And here\'s my first question:');
                    await ctx.replyWithPhoto(streetView.payload.image);
                    await ctx.replyWithHTML('Where is this place?\nTo indicate location please <b>SEND LOCATION</b> having dragged the marker to the needed place', Markup
                        .keyboard(['Pass', 'Hint', 'Restart'])
                        .oneTime()
                        .resize()
                        .extra()
                    );

                    // Update user's state - save the coordinates of place that was shown, state='answering'
                    let q = `UPDATE ${params.usersTable} SET exact_location='${JSON.stringify(streetView.payload.exactLocation)}', should_be='answering' WHERE telegram_id=${userId};`;
                    await getQuery(q);

                    // Update last and top (if needed) score in DB
                    await scoresUpdate(params.usersTable, userId, params.initialScore);
                }

            // ... and answered 'No - I'll enter another one'
            } else if (ctx.update.message.text === 'No - I\'ll enter another one') {
                await ctx.reply('Ok, which one?');

                // State - 'choosing city'
                let q = `UPDATE ${params.usersTable} SET should_be='choosing city' WHERE telegram_id=${userId};`;
                await getQuery(q);
            }

        // User got a question and is answering
        // He/she may a) skip question/see answer, b) get a hint, c) send a location (try to answer), d) restart game
        } else if (usersState === 'answering') {
            // Temp
            if (dbResponseParsed) console.log('Here5');
            console.log(JSON.stringify(dbResponseParsed));

            // User is answering and clicked 'Pass' - show him/her actual location, update balance
            if (ctx.update.message.text === 'Pass') {
                // Temp
                if (dbResponseParsed) console.log('Here6');

                await ctx.reply('Ok. This place was here:');
                await ctx.replyWithPhoto(`https://maps.googleapis.com/maps/api/staticmap?language=en&region=US&zoom=12&size=${params.imageWidth}x${params.imageHeight}&markers=color:green|${dbResponseParsed.rows[0]['exact_location']['lat']},${dbResponseParsed.rows[0]['exact_location']['lng']}&key=${GOOGLE_MAPS_API_KEY}`);
                await ctx.reply(`Check it on Google Street View:\nhttps://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${dbResponseParsed.rows[0]['exact_location']['lat']},${dbResponseParsed.rows[0]['exact_location']['lng']}`);

                let balanceWas = dbResponseParsed.rows[0]['last_score'];
                let newBalance = dbResponseParsed.rows[0]['last_score'] - params.skipImage;

                // Update balance in DB
                await scoresUpdate(params.usersTable, userId, newBalance);

                // Check if user's balance is >0
                if (newBalance <= 0) {
                    await ctx.replyWithHTML(`<b>Ups.. looks like you lost. Try again?</b>`, Markup
                        .keyboard(['Restart'])
                        .oneTime()
                        .resize()
                        .extra()
                    );
                } else {
                    await ctx.replyWithHTML(`Your balance is <b>${balanceWas}-${params.skipImage} = ${newBalance}</b>`, Markup
                        .keyboard(['Next question', 'Restart'])
                        .oneTime()
                        .resize()
                        .extra()
                    );

                    // Update user's state to 'next question'
                    let q = `UPDATE ${params.usersTable} SET should_be='next question' WHERE telegram_id=${userId};`;
                    await getQuery(q);
                }

            // User is answering and clicked 'Restart' - update state, ask to choose city to start
            } else if (ctx.update.message.text === 'Restart') {
                // WTF? Can't understand why "ReferenceError: dbResponseParsed is not defined" in this block
                // while in the block 'Pass' above and 'Hint' below it's 'defined'
                // Might be some silly mistake...
                let q = `SELECT * FROM ${params.usersTable} WHERE telegram_id=${userId}`;
                let dbResponse = await getQuery(q);
                let dbResponseParsed = JSON.parse(dbResponse);
                if (dbResponseParsed) console.log('Here7');

                if (dbResponseParsed.rows[0]['last_city']) {
                    let lastCity = dbResponseParsed.rows[0]['last_city'];
                    await ctx.replyWithHTML('Ok, let\'s start afresh. Please <b>type in a city</b>', Markup
                        .keyboard([lastCity])
                        .oneTime()
                        .resize()
                        .extra());
                    // Otherwise - only suggest to enter city
                } else {
                    await ctx.replyWithHTML('Ok, let\'s start afresh. Please <b>type in a city</b>');
                }

                // Update user's state to 'choosing city'
                q = `UPDATE ${params.usersTable} SET should_be='choosing city' WHERE telegram_id=${userId};`;
                await getQuery(q);

            // User is answering and clicked 'Hint' - give him/her a photo from the same place but with random heading
            // (supposed to be in a different direction but occasionally may be [almost] the same as original photo)
            // User's state remains the same ('answering')
            } else if (ctx.update.message.text === 'Hint') {
                if (dbResponseParsed) console.log('Here8');

                let balanceWas = dbResponseParsed.rows[0]['last_score'];
                let newBalance = dbResponseParsed.rows[0]['last_score'] - params.getHint;

                // Update balance in DB
                await scoresUpdate(params.usersTable, userId, newBalance);

                // Check if user's balance is >0
                if (newBalance<=0) {
                    await ctx.replyWithHTML(`<b>Ups.. looks like you lost. Try again?</b>`, Markup
                        .keyboard(['Restart'])
                        .oneTime()
                        .resize()
                        .extra()
                    );
                } else {
                    await ctx.replyWithHTML(`Ok, here's another photo from the same place\nYour balance is <b>${balanceWas}-${params.getHint} = ${newBalance}</b>`);

                    let randHeading = Math.random() * 360;
                    await ctx.replyWithPhoto(`https://maps.googleapis.com/maps/api/streetview?size=${params.imageWidth}x${params.imageHeight}&location=${dbResponseParsed.rows[0]['exact_location']['lat']},${dbResponseParsed.rows[0]['exact_location']['lng']}&heading=${randHeading}&key=${GOOGLE_MAPS_API_KEY}`);

                    await ctx.replyWithHTML('Where is this place?\nTo indicate location please <b>SEND LOCATION</b> having dragged the marker to the needed place', Markup
                        .keyboard(['Pass', 'Hint', 'Restart'])
                        .oneTime()
                        .resize()
                        .extra()
                    );
                }
            } else {
                if (!ctx.update.message.location) {
                    await ctx.replyWithHTML('Please <b>SEND LOCATION</b> or use the menu below', Markup
                        .keyboard(['Pass', 'Hint', 'Restart'])
                        .oneTime()
                        .resize()
                        .extra()
                    );
                }
            }

            // User sent location
            if (ctx.update.message.location) {
                // Draw a static map image with 2 markers (actual place and user's guess) and a line between them
                await ctx.reply(`Ok. Here's how your answer (red marker) corresponds to actual location (green marker):`);
                await ctx.replyWithPhoto(`https://maps.googleapis.com/maps/api/staticmap?language=en&region=US&zoom=12&size=${params.imageWidth}x${params.imageHeight}&markers=color:green|${dbResponseParsed.rows[0]['exact_location']['lat']},${dbResponseParsed.rows[0]['exact_location']['lng']}&markers=color:red|${ctx.update.message.location.latitude},${ctx.update.message.location.longitude}&path=${dbResponseParsed.rows[0]['exact_location']['lat']},${dbResponseParsed.rows[0]['exact_location']['lng']}|${ctx.update.message.location.latitude},${ctx.update.message.location.longitude}&key=${GOOGLE_MAPS_API_KEY}`);
                await ctx.reply(`Here's the actual place on the Google Street View: \nhttps://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${dbResponseParsed.rows[0]['exact_location']['lat']},${dbResponseParsed.rows[0]['exact_location']['lng']}`);

                // Calculate distance between two markers
                const markerDistance = await distanceBetweenMarkers(dbResponseParsed.rows[0]['exact_location']['lat'], dbResponseParsed.rows[0]['exact_location']['lng'], ctx.update.message.location.latitude, ctx.update.message.location.longitude);
                let distanceVerdict = '';
                if (markerDistance<1) {
                    distanceVerdict = `only about ${Math.round(markerDistance * 1000)} meters`;
                } else {
                    distanceVerdict = `about ${Math.round(markerDistance * 100) / 100} km`
                }

                // Results will be graded using ratio of actual distance between points (km) and 'the size of the city'
                // (decided to use diagonal between the northeast and southwest points/bounds for the city)
                let cityDistance = await distanceBetweenMarkers(dbResponseParsed.rows[0]['last_city_bounds']['bounds']['northeast']['lat'], dbResponseParsed.rows[0]['last_city_bounds']['bounds']['northeast']['lng'], dbResponseParsed.rows[0]['last_city_bounds']['bounds']['southwest']['lat'], dbResponseParsed.rows[0]['last_city_bounds']['bounds']['southwest']['lng']);

                let grade = 0;
                let summary = '';

                if (markerDistance/cityDistance < params.goodAnswerLowerLimit) { // if distance between user's marker and actual place is <10% of city diagonal (km) - good answer, +5
                    grade = 5;
                    summary = 'Excellent answer!';
                }  else if (markerDistance/cityDistance >= params.goodAnswerLowerLimit && markerDistance/cityDistance < params.fairAnswerLowerLimit) { // if distance between user's marker and actual place is >=10% and <50% of city diagonal (km) - fair answer, +2
                    grade = 2;
                    summary = 'Not bad but could be better ;)';
                } else if (markerDistance/cityDistance >= params.fairAnswerLowerLimit) { // if distance between user's marker and actual place is >=50% of city diagonal (km), -2
                    grade = -2;
                    summary = 'Missed! ;)';
                }

                let balanceWas = dbResponseParsed.rows[0]['last_score'];
                let newBalance = dbResponseParsed.rows[0]['last_score'] + grade;
                // Update balance in DB
                await scoresUpdate(params.usersTable, userId, newBalance);

                // Check if user's balance is >0
                if (newBalance<=0) {
                    await ctx.replyWithHTML(`<b>Ups.. looks like you lost. Try again?</b>`, Markup
                        .keyboard(['Restart'])
                        .oneTime()
                        .resize()
                        .extra()
                    );
                } else {
                    await ctx.replyWithHTML(`Straight distance between the markers is ${distanceVerdict}\n${summary}\nYou balance is: <b>${balanceWas}${grade<0 ? '' : '+'}${grade} = ${newBalance}</b>`, Markup
                        .keyboard(['Next question', 'Restart'])
                        .oneTime()
                        .resize()
                        .extra());


                    // Update user's state to 'next question'
                    let q = `UPDATE ${params.usersTable} SET exact_location='${JSON.stringify({})}', should_be='next question' WHERE telegram_id=${userId};`;
                    let dbResponse = await getQuery(q);
                    let dbResponseParsed = JSON.parse(dbResponse);
                    console.log(dbResponseParsed);
                }
            }

        // User either passed a question or answered it and clicked the button 'Next question'
        } else if (usersState === 'next question') {
            if (ctx.update.message.text === 'Restart') {
                let q = `SELECT * FROM ${params.usersTable} WHERE telegram_id=${userId}`;
                let dbResponse = await getQuery(q);
                let dbResponseParsed = JSON.parse(dbResponse);
                if (dbResponseParsed.rows[0].count !== '0') {
                    let lastCity = dbResponseParsed.rows[0].last_city;
                    await ctx.replyWithHTML('Ok, let\'s start afresh. Please <b>type in a city</b>', Markup
                        .keyboard([lastCity])
                        .oneTime()
                        .resize()
                        .extra());
                }
                // Update user's state to 'choosing city'
                q = `UPDATE ${params.usersTable} SET should_be='choosing city' WHERE telegram_id=${userId};`;
                await getQuery(q);

            } else if (ctx.update.message.text === 'Next question') {
                // Get a random Street View image in a given coordinates square (stored in user's state)
                let neLat = dbResponseParsed.rows[0]['last_city_bounds']['bounds']['northeast']['lat'];
                let neLng = dbResponseParsed.rows[0]['last_city_bounds']['bounds']['northeast']['lng'];
                let swLat = dbResponseParsed.rows[0]['last_city_bounds']['bounds']['southwest']['lat'];
                let swLng = dbResponseParsed.rows[0]['last_city_bounds']['bounds']['southwest']['lng'];
                let streetView = await randomStreetView(neLat, neLng, swLat, swLng);

                if (streetView.status === 'ok') {
                    await ctx.replyWithPhoto(streetView.payload.image);

                    await ctx.replyWithHTML('Where is this place?\nTo indicate location please <b>SEND LOCATION</b> having dragged the marker to the needed place', Markup
                        .keyboard(['Pass', 'Hint', 'Restart'])
                        .oneTime()
                        .resize()
                        .extra()
                    );

                    // Update user's state - save the coordinates of place that was shown, state='answering'
                    let q = `UPDATE ${params.usersTable} SET exact_location='${JSON.stringify(streetView.payload.exactLocation)}', should_be='answering' WHERE telegram_id=${userId};`;
                    await getQuery(q);
                }
            }

        // This will be our Default Fallback intent for already contacted users
        } else {
            ctx.replyWithHTML('To start please <b>type in a city</b>');

            // State - 'choosing city'
            let q = `UPDATE ${params.usersTable} SET should_be='choosing city' WHERE telegram_id=${userId};`;
            await getQuery(q);
        }
    }
});


// --------------------- AWS Lambda handler function ---------------------------------------------------------------- //
// https://github.com/telegraf/telegraf/issues/129
exports.handler = (event, context, callback) => {
    const tmp = JSON.parse(event.body); // get data passed to us
    bot.handleUpdate(tmp); // make Telegraf process that data
    return callback(null, { // return something for webhook, so it doesn't try to send same stuff again
        statusCode: 200,
        body: '',
    });
};


// --------------------- Helper Funcions ---------------------------------------------------------------------------- //
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
        });

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

// --------------------- Polling... --------------------------------------------------------------------------------- //
// Not needed if using Webhooks and hosting on AWS Lambda
//bot.startPolling();

