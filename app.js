// Скрипт изменения формата хранения данных с "классического" представления 1..5
// на обновленный -100..100
'use strict';

// контсанты для подключения внешних модулей
const
  pg = require('pg'),
  readline = require('readline')
;

// константы, используемые в программе
const
  // объект с пунктами меню
  menu = {
    // главное меню
    main: {
      text: '\n***** NIDFC *****\n1. Show scenarios\nq. Exit\n> ',
      value: 1,
    },
    // редактирование вопроса
    question: {
      text: '\nQ$q\n\n$a\nConvert to:\nn - nothing\n1 - 1..N by position\n5 - N..1 by position\n- - -100..100 by answers num\n0 - 0..100 by answers num\nq. Main menu\n> ',
      value: 2,
    },
    // список сценариев в системе
    scenario: {
      text: '\nScenarios:\n$s\nq. Main menu\n> ',
      value: 3,
    },
  }
;

let
  // позиция текущего вопроса для обработки
  curPosition = 0,
  // объект текущего вопроса (вместе с ответами) для обработки
  curQuestion = {},
  // сценарий, выбранный для редактирования
  curScenario = {},
  // текущее меню для показа пользователю
  menuPosition = menu.main.value,
  // конфиг для подключения к БД
  pgConfig = {
    database: process.env.KEYHABITS_DB_DB, // база данных
    host: process.env.KEYHABITS_DB_ADDR, // адрес БД
    password: process.env.KEYHABITS_DB_PWD, // пароль пользоватлея
    port: process.env.KEYHABITS_DB_PORT, // порт
    user: process.env.KEYHABITS_DB_USER, // имя пользователя
  },
  // пулер БД
  pgPool = new pg.Pool(pgConfig),
  rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  }),
  // сценарии, доступные для обработки
  scenarios = []
;

// функция получения вопроса с вариантами ответов
function getQuestion(scenario_id, position) {
  let query = `
    SELECT
      sq.id
      ,sq.text
      ,sq.position
      ,(
        SELECT array_to_json(array_agg(t))
        FROM (
          SELECT *
                FROM scenarios_questions_answers sqa
                WHERE sqa.question_id = sq.id
                ORDER BY sqa.position ASC
        ) t
      ) AS answers
    FROM scenarios_questions sq
    WHERE sq.scenario_id=$1
      AND sq.position>$2
      AND sq.type_name IN ('hard', 'fztt', 'fztts')
    ORDER BY sq.position ASC
    LIMIT 1;`;
  return pgPool.query(query, [scenario_id, position]);
}

// функция получения списка сценариев для анонимных исследований
function getScenarios() {
  let query = `
    SELECT
      s.id
      ,s.name
      ,(
        SELECT o.name
        FROM organisations o
        WHERE o.id = r.organisation_id
      ) AS org_name
    FROM scenarios s
    LEFT JOIN researches_scenarios rs ON rs.scenario_id=s.id
    LEFT JOIN researches r ON r.id=rs.research_id
    WHERE r.id NOTNULL
      AND r.type_id = 1
    ORDER BY s.id ASC;`;
  return pgPool.query(query);
}

// функция отображения текста вопроса и его вариантов ответов
function showQuestion(q) {
  curQuestion = q;

  if(curQuestion) {
    // инкремент текущей позиции для выбора следующего вопроса
    curPosition = curQuestion.position;

    menuPosition = menu.question.value;
    let
      // вставка в шаблон меню позиции и текста вопроса
      msg = menu.question.text.replace(/\$q/, `${curQuestion.position}: ${curQuestion.text}`),
      ans = ''
    ;
    // составление списка вариантов ответов
    curQuestion.answers.forEach(el => {
      ans += `${el.position} [${el.value}]. ${el.text}\n`;
    });

    rl.setPrompt(msg.replace(/\$a/, ans));
  }
  else {
    menuPosition = menu.main.value;
    /* eslint-disable no-console */
    console.log('Scenario complete, choose another');
    /* eslint-enable no-console */
    rl.setPrompt(menu.main.text);
  }
}

rl.setPrompt(menu.main.text);
rl.prompt();

rl
.on('line', (line) => {
  let inp = line.trim();

  // обернуть все в промис нужно для того, чтобы приглашение к вводу появлялось ПОСЛЕ операций с БД
  new Promise((resolve) => {
    // главное меню
    if(menuPosition === menu.main.value) {
      // выход
      if(inp === 'q') {
        rl.close();
      }
      // загрузка списка сценариев
      else {
        getScenarios()
        .then(r => {
          scenarios = r.rows;

          // обнуление счетчиков
          curPosition = 0;
          curQuestion = {};

          // составление списка сценариев
          let sList = '';
          scenarios.forEach(el => {
            sList += `${el.id}. ${el.org_name}:${el.name}\n`;
          });

          // установка текущей позиции меню
          menuPosition = menu.scenario.value;
          // отрисовка меню
          rl.setPrompt(menu.scenario.text.replace(/\$s/, sList));

          resolve(0);
        });
      }
    }
    // меню списка доступных для редактирования сценариев
    else if(menuPosition === menu.scenario.value) {
      // возврат в главное меню
      if(inp === 'q') {
        menuPosition = menu.main.value;
        rl.setPrompt(menu.main.text);

        resolve(0);
      }
      // введено числовое значение
      else if(parseInt(inp)) {
        // проверим наличие введенного id в списке сценариев
        curScenario = scenarios.find(e => e.id === parseInt(inp));

        // указанного id в списке сценариев нет
        if(!curScenario) {
          rl.setPrompt('Incorrect scenario id, try again\n> ');

          resolve(0);
        }
        // сценарий выбран, пришло время загрузить первый вопрос
        else {
          getQuestion(curScenario.id, curPosition)
          .then(r => {
            showQuestion(r.rows[0]);

            resolve(0);
          });
        }
      }
      // ввели что-то неверное
      else {
        rl.setPrompt('Incorrect input, try again\n> ');
        resolve(0);
      }
    }
    // меню модификации вопросов и данных
    else if(menuPosition === menu.question.value) {
      // возврат в главное меню
      if(inp === 'q') {
        menuPosition = menu.main.value;
        rl.setPrompt(menu.main.text);

        resolve(0);
      }
      // один из вариантов действий
      else if(['0', '1', '5', '-', 'n'].includes(inp)) {
        // пропуск вопроса
        if(inp === 'n') {
          getQuestion(curScenario.id, curPosition)
          .then(r => {
            showQuestion(r.rows[0]);

            resolve(0);
          });
        }
      }
      // ввели что-то неверное
      else {
        rl.setPrompt('Incorrect input, try again\n> ');
        resolve(0);
      }
    }
  })
  // операции завершены, можно показывать приглашение к вводу новой команды
  .then(() => rl.prompt())
  .catch(e => {
    console.error(e);
  });
})
.on('close', () => {
  /* eslint-disable no-process-exit */
  process.exit(0);
  /* eslint-enable no-process-exit */
});
