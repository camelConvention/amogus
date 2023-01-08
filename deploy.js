const { REST, SlashCommandBuilder, Routes } = require('discord.js');

const commands = [
	new SlashCommandBuilder().setName('draft').setDescription('Drafts a mon!').addStringOption(option =>
		option.setName('mon')
			.setDescription('The mon to draft')
			.setRequired(true)),
  new SlashCommandBuilder().setName('wiggle').setDescription('They do be wiggling'),
  new SlashCommandBuilder().setName('copypasta').setDescription('Posts a random copypasta!'),
  new SlashCommandBuilder().setName('analyze').setDescription('Basically just Porygon bot').addStringOption(option =>
		option.setName('replay')
			.setDescription('The replay to analyze')
			.setRequired(true)),
].map(command => command.toJSON());

const rest = new REST({ version: '10' }).setToken("");

rest.put(Routes.applicationCommands(""), { body: commands }).then((data) => console.log(`Successfully registered ${data.length} application commands.`)).catch(console.error);
