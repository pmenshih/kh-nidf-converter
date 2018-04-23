'use strict';

const
  pg = require('pg'),
  readline = require('readline')
;

const
  menu = {
    main: {
      text: '\n***** NIDFC *****\n1. Show uncoverted scenarios\nq. Exit\n> ',
      value: 1,
    },
    question: {
      text: '\nQuestion $q\n\nAnswers:$a\nConvert to:\n[Enter] - nothing\n1 - 1..N by position\n5 - N..1 by position\n- - -100..100 by answers num\n0 - 0..100 by answers num\nm. Main menu\n> ',
      value: 2,
    },
    scenario: {
      text: '\nScenarios:\n$s\nm. Main menu\n> ',
      value: 3,
    },
  }
;

let
  menuPosition = menu.main.value,
  pgConfig = {
    database: process.env.KEYHABITS_DB_DB, // база данных
    host: process.env.KEYHABITS_DB_ADDR, // адрес БД
    password: process.env.KEYHABITS_DB_PWD, // пароль пользоватлея
    port: process.env.KEYHABITS_DB_PORT, // порт
    user: process.env.KEYHABITS_DB_USER, // имя пользователя
  },
  pgPool = new pg.Pool(pgConfig),
  rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  })
;

rl.setPrompt(menu.main.text);
rl.prompt();

rl
.on('line', (line) => {
  let inp = line.trim();
  if(menuPosition === menu.main.value) {
    if(inp === 'q') {
      rl.close();
    }
    else {
      menuPosition = menu.scenario.value;
      rl.setPrompt(menu.scenario.text);
    }
  }
  else if(menuPosition === menu.scenario.value) {
    if(inp === 'm') {
      menuPosition = menu.main.value;
      rl.setPrompt(menu.main.text);
    }
  }

  rl.prompt();
})
.on('close', () => {
  /* eslint-disable no-process-exit */
  process.exit(0);
  /* eslint-enable no-process-exit */
});
