require('dotenv').config();
const { Client,ActionRowBuilder,GatewayIntentBits, StringSelectMenuBuilder,ActivityType } = require('discord.js');
const { REST } = require('@discordjs/rest');
const { Routes } = require('discord-api-types/v10');
const fs = require('fs');
const yaml = require('yaml');
const axios = require('axios');  // 追加
const token = process.env.TOKEN;
const clientId = process.env.CLIENT_ID;
const guildId = process.env.GUILD_ID;
const guildIds = process.env.GUILD_IDS.split(",");
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
  ],
});
const rest = new REST({ version: '10' }).setToken(token);

const data = yaml.parse(fs.readFileSync('pokemon.yaml', 'utf8'));

client.once('ready', async () => {
  console.log(`Logged in as ${client.user.tag}`);
  client.user.setPresence({
    activities: [{ name: `/pokesearch`, type: ActivityType.Playing }],
    status: 'online',
  });
  try {
    for (const guildId of guildIds) {
      await rest.put(
        Routes.applicationGuildCommands(clientId, guildId),
        { body: [{
            name: 'pokesearch',
            description: 'ポケモンの種族値を検索します。',
            options: [
              {
                name: 'name',
                description: '/pokesearch でポケモンの情報を検索できます。',
                type:3,
                required: true
              }
            ]
          },
          {
            name: 'usd',
            description: 'ドルから円への換算を行います。',
            options: [
              {
                name: 'amount',
                description: '換算するドルの金額',
                type:10,
                required: true
              }
            ]
          },
          {
            name: 'eur',
            description: 'ユーロから円への換算を行います。',
            options: [
              {
                name: 'amount',
                description: '換算するユーロの金額',
                type:10,
                required: true
              }
            ]
          },
          {
            name: 'cny',
            description: '中国人民元から円への換算を行います。',
            options: [
              {
                name: 'amount',
                description: '換算する中国人民元の金額',
                type:10,
                required: true
              }
            ]
          }
        ]}
      );
    }

    console.log('Successfully registered application commands.');
  } catch (error) {
    console.error(error);
  }
});


client.on('interactionCreate', async (interaction) => {
  if (interaction.isCommand()) {
    const { commandName } = interaction;

    if (commandName === 'usd' || commandName === 'eur' || commandName === 'cny') {
      try {
        const amount = interaction.options.getNumber('amount');
        const response = await axios.get(`https://www.alphavantage.co/query?function=CURRENCY_EXCHANGE_RATE&from_currency=${commandName.toUpperCase()}&to_currency=JPY&apikey=${process.env.ALPHA_VANTAGE_API_KEY}`);
        if (response.data["Realtime Currency Exchange Rate"]) {
          const jpyRate = parseFloat(response.data["Realtime Currency Exchange Rate"]["5. Exchange Rate"]);
          const convertedAmount = amount * jpyRate;
          await interaction.reply(`${amount} ${commandName.toUpperCase()} = ${convertedAmount.toFixed(2)} JPY`);
        } else {
          await interaction.reply('通貨換算に失敗しました。しばらく時間をおいて再度お試しください。');
        }
      } catch (error) {
        console.error(error);
        await interaction.reply('通貨換算に失敗しました。しばらく時間をおいて再度お試しください。');
      }
    } else if (commandName === 'pokesearch') {
      const searchName = interaction.options.getString('name');
      const filteredData = data.filter(pokemon => pokemon.Name.includes(searchName));
      if (filteredData.length === 1) {
        await interaction.reply(formatResult(filteredData[0]));
      } else if (filteredData.length > 1 && filteredData.length <= 25) {
        const selectMenu = new ActionRowBuilder()
          .addComponents(
            new StringSelectMenuBuilder()
              .setCustomId('select_pokemon')
              .setPlaceholder('ポケモンを選択してください')
              .addOptions(
                filteredData.map(pokemon => ({
                  label: pokemon.Name,
                  value: pokemon.IndexNum,
                }))
              )
          );

        await interaction.reply({ 
          content:filteredData.length + '件の結果が見つかりました。選択してください。', 
          components: [selectMenu],
          ephemeral: true ,
        });
      } else if (filteredData.length > 25) {
        await interaction.reply({
          content:'検索結果が多すぎるため、より具体的な検索条件を指定して再検索をお願いいたします。',
          ephemeral: true ,
        });
      } else {
        await interaction.reply({
          content:'該当するポケモンが見つかりませんでした。',
          ephemeral: true ,
        });
      }
    }
  } else if (interaction.isStringSelectMenu()) {
    if (interaction.customId === 'select_pokemon') {
      const selectedPokedex = interaction.values[0];
      const selectedPokemon = data.find(pokemon => pokemon.IndexNum === selectedPokedex);
      if (selectedPokemon) {
        await interaction.reply(formatResult(selectedPokemon));
      } else {
        await interaction.reply({
          content:'エラーが発生しました。もう一度お試しください。',
          ephemeral: true ,
        });
      }
    }
  }
});


function formatResult(pokemon) {
  const typeWeaknesses = pokemon.weak.map(weakness => `- ${weakness.type}: ${weakness.magnification}`).join('\n');

  const embed = {
    author: {
      name: pokemon.Name,
      icon_url: pokemon.ImgUrl,
      url: pokemon.URL,
    },
    fields: [
      { name: '全国図鑑番号', value: pokemon.Pokédex, inline: false },
      { name:'',value:'\n\n',inline: false},
      { name: 'タイプ', value: pokemon.type.join(' | '), inline: false },
      { name:'',value:'\n',inline: false},
      { name: 'タイプ相性', value: typeWeaknesses, inline: false },
      { name:'',value:'\n\n',inline: false},
      { name: '[H] HP', value: pokemon.HP, inline: true },
      { name: '[A] 攻撃', value: pokemon.Attack, inline: true },
      { name: '[B] 防御', value: pokemon.Defense, inline: true },
      { name: '[C] 特攻', value: pokemon.SpecialAttack, inline: true },
      { name: '[D] 特防', value: pokemon.SpecialDefense, inline: true },
      { name: '[S] 素早', value: pokemon.Speed, inline: true },
      { name: '合計', value: pokemon.total, inline: false },
      { name:'',value:'\n\n',inline: false},
      { name: '<:pokedex:1105144068264177765> ポケモン徹底攻略 - 図鑑', value: pokemon.URL, inline: false },
      { name: '<:crownpokemon:1105145497313890314> ポケモン徹底攻略 - 育成論', value: pokemon.trainingUrl, inline: false },
      { name:'',value:'\n\n',inline: false},
    ],
    footer: {
      text: "© 2023 Pokémon. © 1995-2023 Nintendo/Creatures Inc. / GAME FREAK inc."
    },
  };

  return { embeds: [embed] };
}

client.login(token);


