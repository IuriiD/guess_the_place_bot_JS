// Telegram - setWebhook
// a) for AWS Lambda
// curl --request POST --url https://api.telegram.org/bot656695873:AAH2YaCAEwVm7r80nP7zH5oWE-Rw4A_SYqQ/setWebhook --header 'content-type: application/json' --data '{"url": "https://mvwzccr507.execute-api.us-east-1.amazonaws.com/default/guessThePlaceBot"}'
// b) for localhost (via ngrok)
// curl --request POST --url https://api.telegram.org/bot656695873:AAH2YaCAEwVm7r80nP7zH5oWE-Rw4A_SYqQ/setWebhook --header 'content-type: application/json' --data '{"url": "https://d52edc2a.ngrok.io"}'

// Telegram - check webhook
// curl --request POST --url https://api.telegram.org/bot656695873:AAH2YaCAEwVm7r80nP7zH5oWE-Rw4A_SYqQ/getWebhookInfo --header 'content-type: application/json'

'use strict';

const Telegraf = require('telegraf');
const Extra = require('telegraf/extra');
const Markup = require('telegraf/markup');
const fetch = require("node-fetch");
const util = require('util'); // used for printing data to console, dealing with circular scructures

const keys = require('./keys');

let state = {}; // storing at which stage of conversation each user is

const bot = new Telegraf(keys.TELEGRAM_TOKEN);

// --------------------- Conversation logic ------------------------------------------------------------------------- //
bot.command(['start', 'restart'], async ctx => {
    const username = ctx.from.first_name;
    const userId = ctx.from.id;

    if (!state[userId]) {
        await ctx.reply(`Hi, ${username}! I'm a GuessThePlaceBot`);
        await ctx.replyWithHTML('Do you know your city well? \nWill you recognize a place by photo?');
    }

    //await ctx.replyWithHTML('To start please type in a city. \nYou can also indicate a city on map by sending a location type attachment');
    await ctx.replyWithHTML('To start please type in a city');

    // let's remember that user with given ID was prompted to choose a city
    state[userId] = {'should be': 'choosing city'};
});


bot.on('message', async ctx => {
    console.log(state);

    const userId = ctx.from.id;

    if (state[userId]) {
        // User is supposed to have entered some city
        // Let's pass his message to Google Maps Geocoding API to confirm it
        // https://developers.google.com/maps/documentation/geocoding/intro
        if (state[userId]['should be'] === 'choosing city') {
            let cityOfInterest = await placeSearch(ctx.update.message.text);

            if (cityOfInterest.status === 'ok') {
                await ctx.replyWithHTML(`Do you mean <b>${cityOfInterest.payload.city}</b>?`, Markup
                    .keyboard(['Right!', 'No - I\'ll enter another one'])
                    .oneTime()
                    .resize()
                    .extra()
                );
            } else {
                await ctx.reply(`Sorry but I failed to determine what is "${ctx.update.message.text}". Could you please try another city?`);
                state[userId]['should be'] = 'choosing city';
            }

            state[userId] = {'should be': 'confirming city'};

        // City entered by user was checked using GMaps Geocoding API, user was asked to confirm if we undersood him/her correctly and
        // answered positively ('Right')
        } else if (state[userId]['should be'] === 'confirming city' && ctx.update.message.text === 'Right') {

        // City entered by user was checked using GMaps Geocoding API, user was asked to confirm if we undersood him/her correctly and
        // answered negatively ('No - I'll enter another one')
        } else if (state[userId]['should be'] === 'confirming city' && ctx.update.message.text === 'No - I\'ll enter another one') {
            await ctx.reply('Ok, which one?');
            state[userId]['should be'] = 'choosing city';

        // This will be our Default Fallback intent for already contacted users
        } else {
            ctx.replyWithHTML('To start please type in a city');
        }
    } else {
        // And here's a Default Fallback intent for new users - unlikely (may be triggered only if bot is reloaded
        // during a dialog)
        const username = ctx.from.first_name;
        await ctx.reply(`Hi, ${username}! I'm a GuessThePlaceBot`);
        await ctx.replyWithHTML('Do you know your city well? \nWill you recognize a place by photo?');
        ctx.replyWithHTML('To start please type in a city');
    }
});

// --------------------- Functions ---------------------------------------------------------------------------------- //
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

// --------------------- Polling... --------------------------------------------------------------------------------- //
bot.startPolling();

/*
// To display a text message with reply button for sharing location
// https://github.com/telegraf/telegraf/blob/develop/docs/examples/keyboard-bot.js#L38
await ctx.reply('Special buttons keyboard', Extra.markup((markup) => {
    return markup.resize()
        .keyboard([
            markup.locationRequestButton('Send location')
        ]).oneTime()
}))
*/

const one = {
    message_id: 339,
    from:
    { id: 178180819,
        is_bot: false,
        first_name: 'Iurii',
        last_name: 'D.',
        language_code: 'ru-RU' },
    chat:
    { id: 178180819,
        first_name: 'Iurii',
        last_name: 'D.',
        type: 'private' },
    date: 1533806714,
    text: 'kiev' }