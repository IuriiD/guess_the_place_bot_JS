// Deployed to AWS Lambda

'use strict';

const Telegraf = require('telegraf');
const Extra = require('telegraf/extra');
const Markup = require('telegraf/markup');
const fetch = require("node-fetch");

const params = require('./parameters');

let state = {}; // storing at which stage of conversation each user is

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

    if (!state[userId]) {
        await ctx.replyWithHTML(`Hi, <b>${username}!</b> I'm a GuessThePlaceBot`);
        await ctx.replyWithHTML('Do you know your city well? \nWill you recognize a place by photo?');
    }

    //await ctx.replyWithHTML('To start please type in a city. \nYou can also indicate a city on map by sending a location type attachment');
    await ctx.replyWithHTML('To start please <b>type in a city</b>');

    // let's remember that user with given ID was prompted to choose a city
    state[userId] = {'should be': 'choosing city'};
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

    try {

        const userId = ctx.from.id;

        if (state[userId]) {
            // User is supposed to have entered some city
            // Let's pass his message to Google Maps Geocoding API to confirm it
            // https://developers.google.com/maps/documentation/geocoding/intro
            // >> SUPPOSED (CORRECT/MAIN) CONVERSATION FLOW
            if (state[userId]['should be'] === 'choosing city') {
                let cityOfInterest = await placeSearch(ctx.update.message.text);

                if (cityOfInterest.status === 'ok') {
                    await ctx.replyWithPhoto(`https://maps.googleapis.com/maps/api/staticmap?language=en&region=US&center=${cityOfInterest.payload.latitude},${cityOfInterest.payload.longitude}&zoom=12&size=${params.imageWidth}x${params.imageHeight}&key=${GOOGLE_MAPS_API_KEY}`);

                    await ctx.replyWithHTML(`Do you mean <b>${cityOfInterest.payload.city}</b>?`, Markup
                        .keyboard(['Right!', 'No - I\'ll enter another one'])
                        .oneTime()
                        .resize()
                        .extra()
                    );

                    state[userId] = {
                        'should be': 'confirming city',
                        'bounds': cityOfInterest.payload.bounds
                    };

                } else {
                    await ctx.reply(`Sorry but I failed to determine what is "${ctx.update.message.text}". Could you please enter another city?`);
                    state[userId]['should be'] = 'choosing city';
                }

            // City entered by user was checked using GMaps Geocoding API, user was asked to confirm if we understood him/her correctly
            } else if (state[userId]['should be'] === 'confirming city') {
                console.log(ctx.update.message.text);
                // .. and answered positively ('Right')
                // >> SUPPOSED (CORRECT/MAIN) CONVERSATION FLOW
                if (ctx.update.message.text === 'Right!') {
                    await ctx.replyWithHTML(`Ok, here we go ;)\n<b>Here are the rules:</b>\n- initial score: <b>${params.initialScore}</b>\n- skip image: <b>-${params.skipImage}</b>\n- get a hint: <b>-${params.getHint}</b>\n- poor answer: <b>-${params.poorAnswer}</b>\n- fair answer: <b>+${params.fairAnswer}</b>\n- good answer: <b>+${params.goodAnswer}</b>`);
                    await ctx.replyWithHTML(`To indicate location please <b>SEND LOCATION</b> having dragged the marker to the needed place as shown below:`);
                    await ctx.replyWithPhoto('https://iuriid.github.io/public/img/gtpb-how_to_send_location.png');

                    // Get a random Street View image in a given coordinates square (stored in user's state)
                    let streetView = await randomStreetView(state[userId].bounds.northeast.lat,
                        state[userId].bounds.northeast.lng, state[userId].bounds.southwest.lat, state[userId].bounds.southwest.lng);

                    if (streetView.status === 'ok') {
                        // Store exact place's coordinates in user's state
                        await ctx.reply('And here\'s my first question:');

                        await ctx.replyWithPhoto(streetView.payload.image);
                        // For testing
                        //await ctx.reply(`https://www.google.com/maps/@${streetView.payload.exactLocation.lat},${streetView.payload.exactLocation.lng},18z`);

                        await ctx.replyWithHTML('Where is this place?\nTo indicate location please <b>SEND LOCATION</b> having dragged the marker to the needed place', Markup
                            .keyboard(['Pass', 'Hint', 'Restart'])
                            .oneTime()
                            .resize()
                            .extra()
                        );

                        // Update user's state - save the coordinates of place that was shown, state='answering', (initial) balance=20
                        state[userId]['exactLocation'] = streetView.payload.exactLocation;
                        state[userId]['should be'] = 'answering';
                        state[userId]['balance'] = params.initialScore;
                    }

                    // ... and answered negatively ('No - I'll enter another one')
                } else if (ctx.update.message.text === 'No - I\'ll enter another one') {
                    await ctx.reply('Ok, which one?');
                    state[userId]['should be'] = 'choosing city';
                }

            // User got a question and is answering
            // He/she may a) pass/see answer, b) get a hint, c) send a location=answer, d) restart game
            } else if (state[userId]['should be'] === 'answering') {
                // User is answering and clicked 'Pass' - show him/her actual location, update balance
                if (ctx.update.message.text === 'Pass') {
                    await ctx.reply('Ok. This place was here:');
                    await ctx.replyWithPhoto(`https://maps.googleapis.com/maps/api/staticmap?language=en&region=US&zoom=12&size=${params.imageWidth}x${params.imageHeight}&markers=color:green|${state[userId].exactLocation.lat},${state[userId].exactLocation.lng}&key=${GOOGLE_MAPS_API_KEY}`);
                    await ctx.reply(`Check it on Google Street View:\nhttps://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${state[userId].exactLocation.lat},${state[userId].exactLocation.lng}`);

                    let balanceWas = state[userId]['balance'];
                    let newBalance = state[userId]['balance'] - params.skipImage;
                    state[userId]['balance'] = newBalance;

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
                        state[userId]['should be'] = 'next question';
                    }

                // User is answering and clicked 'Restart' - update state, ask to choose city to start
                } else if (ctx.update.message.text === 'Restart') {
                    await ctx.replyWithHTML('Ok, let\'s start afresh. <b>Please type in a city</b>');
                    state[userId] = {'should be': 'choosing city'};

                // User is answering and clicked 'Hint' - give him/her a photo from the same place but with random heading
                // (supposed to be to a different direction but occasionally may be almost the same)
                // User's state remains the same ('answering')
                } else if (ctx.update.message.text === 'Hint') {
                    let balanceWas = state[userId]['balance'];
                    let newBalance = state[userId]['balance'] - params.getHint;
                    state[userId]['balance'] = newBalance;

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
                        await ctx.replyWithPhoto(`https://maps.googleapis.com/maps/api/streetview?size=${params.imageWidth}x${params.imageHeight}&location=${state[userId].exactLocation.lat},${state[userId].exactLocation.lng}&heading=${randHeading}&key=${GOOGLE_MAPS_API_KEY}`);

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
                    await ctx.replyWithPhoto(`https://maps.googleapis.com/maps/api/staticmap?language=en&region=US&size=${params.imageWidth}x${params.imageHeight}&markers=color:green|${state[userId]['exactLocation']['lat']},${state[userId]['exactLocation']['lng']}&markers=color:red|${ctx.update.message.location.latitude},${ctx.update.message.location.longitude}&path=${state[userId]['exactLocation']['lat']},${state[userId]['exactLocation']['lng']}|${ctx.update.message.location.latitude},${ctx.update.message.location.longitude}&key=${GOOGLE_MAPS_API_KEY}`);
                    //await ctx.replyWithPhoto(`https://maps.googleapis.com/maps/api/staticmap?language=en&region=US&zoom=12&size=${params.imageWidth}x${params.imageHeight}&markers=color:green|${state[userId]['exactLocation']['lat']},${state[userId]['exactLocation']['lng']}&markers=color:red|${ctx.update.message.location.latitude},${ctx.update.message.location.longitude}&path=${state[userId]['exactLocation']['lat']},${state[userId]['exactLocation']['lng']}|${ctx.update.message.location.latitude},${ctx.update.message.location.longitude}&key=${GOOGLE_MAPS_API_KEY}`);
                    await ctx.reply(`Here's the actual place on the Google Street View: \nhttps://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${state[userId].exactLocation.lat},${state[userId].exactLocation.lng}`);

                    // Calculate distance between two markers
                    const markerDistance = await distanceBetweenMarkers(state[userId]['exactLocation']['lat'], state[userId]['exactLocation']['lng'], ctx.update.message.location.latitude, ctx.update.message.location.longitude);
                    let distanceVerdict = '';
                    if (markerDistance<1) {
                        distanceVerdict = `only about ${Math.round(markerDistance * 1000)} meters`;
                    } else {
                        distanceVerdict = `about ${Math.round(markerDistance * 100) / 100} km`
                    }

                    // Results will be graded using ratio of actual distance between points (km) and 'the size of the city'
                    // (decided to use diagonal between the northeast and southwest points/bounds for the city)
                    let cityDistance = await distanceBetweenMarkers(state[userId]['bounds']['northeast']['lat'], state[userId]['bounds']['northeast']['lng'], state[userId]['bounds']['southwest']['lat'], state[userId]['bounds']['southwest']['lng']);

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

                    let balanceWas = state[userId]['balance'];
                    let newBalance = state[userId]['balance'] + grade;
                    state[userId]['balance'] = newBalance;

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

                        state[userId]['should be'] = 'next question';
                        state[userId]['exact location'] = {};
                    }
                }

            // User either passed a question or answered it and clicked the button 'Next question'
            } else if (state[userId]['should be'] === 'next question') {
                // Get a random Street View image in a given coordinates square (stored in user's state)
                let streetView = await randomStreetView(state[userId].bounds.northeast.lat,
                    state[userId].bounds.northeast.lng, state[userId].bounds.southwest.lat, state[userId].bounds.southwest.lng);

                if (streetView.status === 'ok') {
                    await ctx.replyWithPhoto(streetView.payload.image);

                    await ctx.replyWithHTML('Where is this place?\nTo indicate location please <b>SEND LOCATION</b> having dragged the marker to the needed place', Markup
                        .keyboard(['Pass', 'Hint', 'Restart'])
                        .oneTime()
                        .resize()
                        .extra()
                    );

                    // Update user's state - save the coordinates of place that was shown, state='answering', (initial) balance=20
                    state[userId]['exactLocation'] = streetView.payload.exactLocation;
                    state[userId]['should be'] = 'answering';
                }

            // This will be our Default Fallback intent for already contacted users
            } else {
                ctx.replyWithHTML('To start please <b>type in a city</b>');
                state[userId]['should be'] = 'choosing city';
            }
        } else {
            // And here's a Default Fallback intent for new users - unlikely (may be triggered only if bot is reloaded
            // during a dialog)
            const username = ctx.from.first_name;
            await ctx.reply(`Hi, ${username}! I'm a GuessThePlaceBot`);
            await ctx.replyWithHTML('Do you know your city well? \nWill you recognize a place by photo?');
            ctx.replyWithHTML('To start please <b>type in a city</b>');
            state[userId] = {'should be': 'choosing city'};
        }

        console.log();
        console.log(JSON.stringify(state));
    } catch(error) {
        console.log(`>> Main conversation flow handler: ${error}`);
        ctx.replyWithHTML('Looks like something wrong has happened.. Could you please try to <b>/restart</b> the bot? Thanks and please accept my apologies');
    }
});


// --------------------- AWS Lambda handler function ---------------------------------------------------------------- //
// https://github.com/telegraf/telegraf/issues/129
exports.handler = (event, context, callback) => {
    bot.handleUpdate(JSON.parse(event.body)); // make Telegraf process that data
    return callback(null, { statusCode: 200, body: JSON.stringify({ message: 'OK' }) });
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

        /*
        console.log(i);
        console.log('metadataQuery:');
        console.log(metadataQuery);
        console.log('imageQuery:');
        console.log(imageQuery);
        console.log('webMap:');
        console.log(webMap);
        console.log();
        */

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


// --------------------- Polling... --------------------------------------------------------------------------------- //
// Not needed if using Webhooks and hosting on AWS Lambda
//bot.startPolling();

