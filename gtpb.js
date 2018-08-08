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
const util = require('util');

const keys = require('./keys');

let state = {};

const bot = new Telegraf(keys.TELEGRAM_TOKEN);

bot.command(['start', 'restart'], async ctx => {
    const username = ctx.from.first_name;
    const userId = ctx.from.id;

    await ctx.reply(`Hi, ${username}! I'm a GuessThePlaceBot`);
    await ctx.replyWithHTML('Do you know your city well? \nCan you guess a place by photo?');
    await ctx.reply('To start please type in a city or send me a location type attachment to choose a city on the map');

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


    // let's remember that user with given ID was prompted to choose a city
    if (!state[userId]) {
        state[userId] = {'should be': 'choosing city'};
    }
});


bot.on('message', (ctx) => {
    const userId = ctx.from.id;

    if (state[userId]) {
        if (state[userId]['should be'] === 'choosing city') {
            ctx.reply('So you entered a city ...');
        }
    }
});



bot.startPolling();

