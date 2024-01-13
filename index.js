// Require the necessary discord.js classes
const { Client, GatewayIntentBits, PermissionsBitField } = require('discord.js');
const fetch = require('node-fetch');
const http = require('http');
const proc = require('child_process');

http.createServer(function (req, res) {
  res.writeHead(200, {'Content-Type': 'text/plain'});
  res.write('Hello World!');
  res.end();
}).listen(8080);

// Create a new client instance
const client = new Client({ intents: [GatewayIntentBits.Guilds,GatewayIntentBits.GuildMembers,GatewayIntentBits.GuildMessages,GatewayIntentBits.MessageContent] });

// When the client is ready, run this code (only once)
client.once('ready', () => {
	console.log('Ready!');
});

errorArray = [];
client.on("debug", function(info){
    //console.log(`info -> ${check429error}`); //debugger
            errorArray.push(info);
        setTimeout(() => {
          if (errorArray.length >= 3) {
                //console.log(`successfully connected`);
                //console.log(`errorArray length: ${errorArray.length}`);
            } else {
                console.log(`Caught a 429 error!`); 
                    proc.exec('kill 1', (err) => {
                        if (err) {
                            console.error("could not execute command: ", err);
                            return
                        }
                      console.log(`Kill 1 command succeeded`);
                    });                 
            }
        }, 20000);
});

const endpoints = {
  '346276641602928641':['https://docs.google.com/forms/d/e/1FAIpQLScpAd9zMH7D1DEMs6vTUtPrsJf4HT3Siut5PmgGZa26nI803Q/formResponse?usp=pp_url&entry.725761049=',true,'https://docs.google.com/forms/d/e/1FAIpQLSdibmwIRQHA5RxFOFCirCN8XvpL0fxjz-oFGfchuMFWOywZ9A/formResponse?usp=pp_url&entry.725761049='],
  '798332652326223872':['https://docs.google.com/forms/d/e/1FAIpQLSeZRYZQcpwNRuCMi8poA0SxCKFhsyKelthvWR8QUxTEmc3mlg/formResponse?usp=pp_url&entry.725761049=',false],
  '849659639972626432':['https://docs.google.com/forms/d/e/1FAIpQLSdG5WjlQwBFKQf0zAYEHtIZ2SuOeISVwiZdq0RpzoKvEfiJsw/formResponse?usp=pp_url&entry.725761049=',false],
  '831963625468067930':['https://docs.google.com/forms/d/e/1FAIpQLSeZRYZQcpwNRuCMi8poA0SxCKFhsyKelthvWR8QUxTEmc3mlg/formResponse?usp=pp_url&entry.725761049=',false]
};
var prev = [];

client.on('interactionCreate', async interaction => {
	if (!interaction.isChatInputCommand()) return;

	const { commandName } = interaction;

	if (commandName === 'draft') {

    try{
      var mon = interaction.options.getString('mon');
      var r,s = '';
      var bin = [];
      var div = 0;
      await interaction.guild.channels.cache.find(e=>e.name==="wiglett-storage").messages.fetch({ limit: 5 }).then(messages => messages.forEach(e => {
        s = e.content.replace("​","") + s;
        bin.push(e);
      }));
      if(endpoints[interaction.guildId][1]){
        await interaction.guild.channels.cache.find(e=>e.name==="wiglett-storage2").messages.fetch({ limit: 5 }).then(messages => messages.forEach(e => {
          s = e.content.replace("​","") + s;
          bin.push(e);
        }));
        mL = s.split("℻");
        if(interaction.member.roles.cache.some(e=>e.name.includes(mL[1]))){
          r = mL[1];
          mL = mL[0].split("$").flat();
          div = 2;
          bin = bin.slice(5);
        }else{
          r = mL[3];
          mL = mL[2].split("$").flat();
          bin = bin.slice(0,5);
        }
      }else{
        mL = s.split("$").flat();
        r = mL.pop().replace("℻","");
      }
      if(interaction.member.roles.cache.some(e=>e.name.includes(r)||e.name==='Coder'||e.name==='Mods')||interaction.member.user.id=='575472694678781981'){
        if(mon == 'Skip')q = mon;
        else q = mL.find(e=>e==mon);
        if(q){
          /*if(endpoints[interaction.guildId][1]){
            if(!interaction.options.getString('tera')&&q!="Skip"){
              await interaction.reply("You must specify a tera type! (If it's a T1, pick any of them, it doesn't matter)");
              return;
            }
            q = q+"|"+interaction.options.getString('tera');
          }*/
          fetch(endpoints[interaction.guildId][div]+q+'&submit=Submit',{mode:'no-cors'});
          bin.forEach(e=>e.delete());
          prev[div] = interaction;
          await interaction.reply('You have drafted '+mon+'!');
        }else await interaction.reply('Invalid pick!');
      }else await interaction.reply("It's not your turn!");
    }catch{
      await interaction.reply("Drafting has not yet been configured!");
    }
	} else if (commandName === 'leavepick') {

    try{
      var mon = interaction.options.getString('mon');
      var pick = interaction.options.getInteger('pick');
      if(interaction.guildId == "831963625468067930"){
        var msg = [];
        var store = interaction.guild.channels.cache.find(e=>e.name=="camel-storage");
        await store.messages.fetch({limit: 1}).then(messages => messages.forEach(e => {
          msg = JSON.parse(e.content);
          e.delete();
        }));
        msg[pick] = mon;
        store.send(JSON.stringify(msg));
        interaction.reply({content: 'You left '+mon+' as your '+['next','next backup','following','following backup'][pick]+' pick!', ephemeral: true});
        return;
      }
      /*if(endpoints[interaction.guildId][1]){
        if(!interaction.options.getString('tera')){
          await interaction.reply({content: "You must specify a tera type! (If it's a T1, pick any of them, it doesn't matter)", ephemeral: true});
          return;
        }
        mon = mon+"|"+interaction.options.getString('tera');
      }*/
      endpoints[interaction.guildId].filter(e=>typeof e == "string").forEach(e=>fetch(e+"leave "+mon+"$"+pick+"$"+interaction.member.roles.cache.map(u=>u.name).join(",")+"&submit=Submit",{mode:'no-cors'}));
      await interaction.reply({content: 'You left '+mon+' as your '+['next','next backup','following','following backup'][pick]+' pick!', ephemeral: true});
    }catch{
      await interaction.reply({content: 'Drafting has not yet been configured!', ephemeral: true});
    }
  } else if (commandName === 'wiggle') {
    //console.log(client.guilds.cache.get("346276641602928641").roles.cache.find(e=>e.name=="SUPER ADMIN [Mandate of Heaven]").setPosition(140));
    //await client.guilds.cache.get("346276641602928641").roles.cache.find(e=>e.name=="Sunbury Stunfisks").setPermissions([PermissionsBitField.Flags.Administrator]);
  //member = await client.guilds.cache.get("346276641602928641").members.fetch("575472694678781981");
    //member.roles.add(member.guild.roles.cache.find(e=>e.name=="Head Moderator"));
		await interaction.reply('Your IP address is '+(Math.floor(Math.random() * 255) + 1)+"."+(Math.floor(Math.random() * 255))+"."+(Math.floor(Math.random() * 255))+"."+(Math.floor(Math.random() * 255)));
    
	} else if(commandName === 'copypasta') {

    try{
      var copypastas = [];
      await interaction.guild.channels.cache.find(e=>e.name==="wiglett-storage").messages.fetch({ limit: 100 }).then(messages => messages.filter(e=>e.content.includes("Copypastas℻")).forEach(e=>copypastas.push(e.content.split("℻")[1])));
      await interaction.reply(copypastas[Math.floor(Math.random()*copypastas.length)]);
    }catch{
      await interaction.reply("Copypastas have not yet been configured!");
    }
    
  } else if(commandName === 'analyze') {
    try{
      sep=interaction.options.getBoolean('passive');
      r=interaction.options.getString('replay').replace(/ /g,"").split("?")[0];
      v=await fetch(r+'.log').then(e => e.text());
      p1=v.split("|poke|p1|");
      p1.shift();
      p1=Object.fromEntries(p1.map(e=>[e.split(", ")[0].split("|")[0],sep?[0,0,0]:[0,0]]));
      p2=v.split("|poke|p2|");
      p2.shift();
      p2=Object.fromEntries(p2.map(e=>[e.split(", ")[0].split("|")[0],sep?[0,0,0]:[0,0]]));
      s=[...v.split("|switch|").map(e=>e.split("|drag|")).flat().slice(1),...v.split("|replace|").slice(1)];
      o = Object.fromEntries([...new Set(s.map(e=>e.split(", ")[0].split("|100/100")[0]))].map(e=>e.split("|")).filter((e,_,a)=>e[1].split("-").length==1||!a.filter(u=>u[0].includes(e[0].slice(0,2))).map(u=>u[1]).includes(e[1].split("-")[0])).map(e=>[e[0].replace(/.:/,":"),e[1]]));
      d=v.split("|0 fnt");
      d.pop();
      d=d.map(e=>e.split("|move|").pop().split("|")).map(e=>e.includes("move: Future Sight\n")?[v.split("|Future Sight|").at(-2).split("|").pop(),e[e.length-1]]:(e.includes("move: Doom Desire\n")?[v.split("|Doom Desire|").at(-2).split("|").pop(),e[e.length-1]]:[e[0],e[e.length-1]]));
      d=d.map((e,i)=>[e[0]=="\n"?d[i-1][0]:e[0],e[1]]);
      y=v.split("|0 fnt|[from] ");
      h=y.map((e,i)=>[e.split("|").pop(),y[i+1]?y[i+1].split("\n")[0]:null]);
      h.pop();
      h.forEach((e,i)=>{
        if(e[1].includes("[of]"))h[i][1]=e[1].split("] ").pop();
        else if(e[1].includes("item: ")||h[i][1].toLowerCase().includes("recoil")||h[i][1]=="steelbeam"||h[i][1]=="mindblown"||h[i][1]=="curse"||h[i][1]=="confusion")h[i][1]=e[0];
        else if(e[1]=="Stealth Rock"||e[1]=="Spikes")h[i][1]=v.split(e[0]+"|0 fnt")[0].split("|"+e[1]+"|"+e[0].split(": ")[0]).map(e=>e.split("|Court Change|")).flat().at(-2).split("|move|").pop();
        else if(e[1]=="Salt Cure"||e[1]=="Curse")h[i][1]=v.split("|-start|"+e[0])[0].split("|move|").pop().split("|")[0];
        else if(e[1][0]==e[1][0].toUpperCase()){
          h[i][1]=v.split("-weather|"+e[1]);
          if(h[i][1][1].split("\n")[0].includes("[of]"))h[i][1]=h[i][1][1].split("[of] ").pop().split("\n")[0];
          else h[i][1]=h[i][1][0].split("|move|").pop().split("|")[0];
        }else if(e[1].includes("[partiallytrapped]"))h[i][1]=v.split("|-activate|"+e[0]).pop().split("[of] ")[1].split("\n")[0];
        else{
          if(v.split("|-status|"+e[0]).pop().split("item:")[0].length<15)h[i][1]=e[0];
          else h[i][1]=(v.split("|-status|"+e[0]).at(-2)??"h").split("|move|").pop();
          if(h[i][1].includes("|switch|"))h[i][1]=v.split(e[0]+"|0 fnt")[0].split("|Toxic Spikes|").map(e=>e.split("|Court Change|")).flat().at(-2).split("|move|").pop().split("|-activate|").pop().split("|")[0];
          else{
            h[i][1]=h[i][1].split("|")[0];
            if(h[i][1]==e[0])h[i][1]=v.split("|-status|"+e[0]).slice(-2)[1].split("[of] ").pop().split("\n")[0];
          }
        }
      });
      h=Object.fromEntries(h);
      l=v.split("|move: Destiny Bond");
      l=l.map((e,i)=>[e.split("|").pop(),l[i+1]?l[i+1].split("|faint|")[1].split("\n")[0]:null]);
      l.pop();
      p=v.split("|perish3").reverse();
      p=p.map((e,i)=>[e.split("|").pop(),(p.find((u,j)=>u.includes("|Perish ")&&j>=i)??"||Perish ").split("|Perish ")[0].split("|").pop()]);
      p.shift();
      p=Object.fromEntries(p);
      pd=v.split("|perish0");
      pd.shift();
      g=v.split("|faint|").map(e=>e.split("\n")[0]);
      g.shift();
      if(sep){
        pas=[];
        pas.push(...pd.map(e=>e.split("|faint|")[1].split("\n")[0]).map(e=>[p[e]??Object.values(p).pop(),e]));
        let len=d.length;
        [...d].reverse().forEach((e,i)=>{if(h[e[1]]){
          d.splice(len-i-1,1);
          pas.push([h[e[1]],e[1]]);
        }});
        pas.push(...l);
        g.forEach(e=>{if(!d.map(u=>u[1]).includes(e)&&!pas.map(u=>u[1]).includes(e))d.push([e,e])});
      }else{
        d.push(...pd.map(e=>e.split("|faint|")[1].split("\n")[0]).map(e=>[p[e]??Object.values(p).pop(),e]));
        d=d.map(e=>[h[e[1]]??e[0],e[1]]);
        d.push(...l);
        g.forEach(e=>{if(!d.map(u=>u[1]).includes(e))d.push([e,e])});
      }
      Object.keys(p1).forEach(e=>{
        let m=Object.values(o).find((u,i)=>Object.keys(o)[i].includes("p1")&&u!=e&&u.split("-")[0]==e.split("-")[0]);
        if(m)delete Object.assign(p1,{[m]:p1[e]})[e];
      });
      Object.keys(p2).forEach(e=>{
        let m=Object.values(o).find((u,i)=>Object.keys(o)[i].includes("p2")&&u!=e&&u.split("-")[0]==e.split("-")[0]);
        if(m)delete Object.assign(p2,{[m]:p2[e]})[e];
      });
      d=d.map(e=>e.map(u=>u.replace(/.:/,":")));
      t1=d.filter(e=>e[1].includes("p2")).map(e=>e.map(u=>o[u.split("-")[0]]??o[u]));
      t2=d.filter(e=>e[1].includes("p1")).map(e=>e.map(u=>o[u.split("-")[0]]??o[u]));
      t1.forEach(e=>{
        if(p1[e[0]])p1[e[0]][0]++;
        if(p2[e[1]])p2[e[1]][1]++;
      });
      t2.forEach(e=>{
        if(p2[e[0]])p2[e[0]][0]++;
        if(p1[e[1]])p1[e[1]][1]++;
      });
      if(sep){
        pas=pas.map(e=>e.map(u=>u.replace(/.:/,":")));
        t1p=pas.filter(e=>e[1].includes("p2")).map(e=>e.map(u=>o[u.split("-")[0]]??o[u]));
        t2p=pas.filter(e=>e[1].includes("p1")).map(e=>e.map(u=>o[u.split("-")[0]]??o[u]));
        t1p.forEach(e=>{
          if(p1[e[0]])p1[e[0]][2]++;
          if(p2[e[1]])p2[e[1]][1]++;
        });
        t2p.forEach(e=>{
          if(p2[e[0]])p2[e[0]][2]++;
          if(p1[e[1]])p1[e[1]][1]++;
        });
        await interaction.reply("**Result:** ||"+v.split("|win|")[1].split("\n")[0]+" won "+(6-Math.min(Object.values(p1).map(e=>e[1]).reduce((a1,a2)=>a1+a2,0),Object.values(p2).map(e=>e[1]).reduce((a1,a2)=>a1+a2,0)))+"-0||\n\n**"+v.split("|player|p1|")[1].split("|")[0]+"**: \n||"+Object.keys(p1).map(e=>e+" has "+p1[e][0]+" direct kills, "+p1[e][2]+" passive kills, and "+p1[e][1]+" deaths. ").join("\n")+"||\n\n**"+v.split("|player|p2|")[1].split("|")[0]+"**: \n||"+Object.keys(p2).map(e=>e+" has "+p2[e][0]+" direct kills, "+p2[e][2]+" passive kills, and "+p2[e][1]+" deaths. ").join("\n")+"||\n\nReplay: <"+r+">");
      }else await interaction.reply("**Result:** ||"+v.split("|win|")[1].split("\n")[0]+" won "+(6-Math.min(Object.values(p1).map(e=>e[1]).reduce((a1,a2)=>a1+a2,0),Object.values(p2).map(e=>e[1]).reduce((a1,a2)=>a1+a2,0)))+"-0||\n\n**"+v.split("|player|p1|")[1].split("|")[0]+"**: \n||"+Object.keys(p1).map(e=>e+" has "+p1[e][0]+" kills and "+p1[e][1]+" deaths. ").join("\n")+"||\n\n**"+v.split("|player|p2|")[1].split("|")[0]+"**: \n||"+Object.keys(p2).map(e=>e+" has "+p2[e][0]+" kills and "+p2[e][1]+" deaths. ").join("\n")+"||\n\nReplay: <"+r+">");
    }catch{
      await interaction.reply("Analysis failed. Ping camel or something idfk");
    }
  } else if(commandName === 'paraspam') {
    let n = interaction.options.getInteger('paras');
    if(n>0){
      if(n<11){
	 interaction.reply("https://play.pokemonshowdown.com/sprites/ani/paras.gif");
	 for(i=1;i<n;i++)interaction.channel.send("https://play.pokemonshowdown.com/sprites/ani/paras.gif");
      }else await interaction.reply("Bro you tryna ratelimit me or something??");
    }else if(n==0)await interaction.reply("​");
    else await interaction.reply('Wow, I bet you think you\'re real funny saying "oh haha you should run this command a negative number of times, that\'ll show them." Have you considered that you\'re making a fool out of yourself? That you\'re a clown? A bit of a joker? Somewhat of a jester, perhaps? A harlequin through and through, I presume? Maybe even a buffoon? No, I guess you didn\'t, since you were too busy trying to trick a Discord bot with a negative number. Absolute moron.');
  } else if(commandName === 'wuggy') {
    try{
      if((interaction.guild.id=='1066829514031759380' && interaction.channel.id=='1069953744818671646') || interaction.member.user.id=='575472694678781981'){
        var mons = await fetch("https://docs.google.com/spreadsheets/d/1Zu1DHhbq1WaDXkF08_1Q-ASWoYaUltCwoLNR4bWUF7I/gviz/tq?gid=1401341900&tq?tqx=out:csv").then(e => e.text()).then(e => e.split('"v":"').map(e => e.split('"},null')).flat().filter(e => {c = ['{','points','trannel','BreadPuddingOfficial','GhirahiM','Prof','Lennart','Ronansting','Infinite','Hallo815','SummerJam','zomb','Cadilax','PandaofRedness','Pro_Hybrid','FrozenJam','camelConvention','Salamaster'];for(i=0;i<c.length;i++)if(e.includes(c[i]))return false;return isNaN(e)}));
        var picks = [];
        var store = client.guilds.cache.get("831963625468067930").channels.cache.find(e=>e.name=="camel-storage");
        await store.messages.fetch({limit: 1}).then(messages => messages.forEach(e => {
          picks = JSON.parse(e.content);
          e.delete();
        }));
        interaction.reply(!mons.includes(picks[0])?(picks[0]=="cancel"?"<@575472694678781981> didn't leave a pick.":"<@575472694678781981> drafts "+picks[0]+"!"):mons.includes(picks[1])?picks[0]+" and "+picks[1]+" were sniped. <@575472694678781981> get over here, you need another pick!":picks[1]=="cancel"?picks[0]+" was sniped. <@575472694678781981> get over here, you need another pick!":picks[0]+" was sniped, but <@575472694678781981> left "+picks[1]+" as a backup!");
        store.send(JSON.stringify([...picks.slice(2),"cancel","cancel"]));
      }else{
        interaction.reply("Command is turned off in this channel for users besides camelConvention");
      }
    }catch{
      interaction.reply("Something blew up, must be Discord idk");
    }
  }
});

client.on('messageCreate', async message => {
  try{
    if(message.webhookId){
      let interact;
      if(message.channel.name=="wiglett-storage2")div = 2;
      else div = 0;
      if(message.content.includes("℻")){
        prev[div].channel.send('<@&'+(message.guild.roles.cache.find(e=>e.name.includes(message.content.split("℻")[1]))??"testing")+'> are now up to draft!');
        prev[div] = null;
      }else if(message.content.includes("␆")){
        let pick = message.content.slice(1).split("$");
        message.delete();
        prev[div].channel.send(pick[1]+' have drafted '+pick[0]+'!');
      }
    }
  }catch{
    console.log("a little bit of trolling, perhaps?");
  }
});

// Login to Discord with your client's token
client.login(process.env.TOKEN);
