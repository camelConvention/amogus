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

client.on('interactionCreate', async interaction => {
	if (!interaction.isChatInputCommand()) return;

	const { commandName } = interaction;

	if (commandName === 'draft') {

    try{
      var endpoints = {
        '346276641602928641':['https://docs.google.com/forms/d/e/1FAIpQLSegS9sxDDg3VitVRCSweeIq5LfYtKkqmCP9sX0e5qnxPpIUqw/formResponse?usp=pp_url&entry.725761049=',true],
        '798332652326223872':['https://docs.google.com/forms/d/e/1FAIpQLSeZRYZQcpwNRuCMi8poA0SxCKFhsyKelthvWR8QUxTEmc3mlg/formResponse?usp=pp_url&entry.725761049=',false]
      };
      var mon = interaction.options.getString('mon');
      var r,s = '';
      var bin = [];
      await interaction.guild.channels.cache.find(e=>e.name==="wiglett-storage").messages.fetch({ limit: 5 }).then(messages => messages.forEach(e => {
        s = e.content + s;
        bin.push(e);
      }));
      s = s.split("$");
      r = s.pop().replace("℻","");
      console.log(r);
      if(interaction.member.roles.cache.some(e=>e.name===r||e.name==='Coder'||e.name==='Mods')){
        mL = s.map((e,i)=>endpoints[interaction.guildId][1]?e.split("&").map(l=>l+"("+(e.includes('-Mega')?"MT":"T")+(i%5+1)):e).flat();
        if(mon == 'Skip')q = mon;
        else q = mL.find(e=>e.replace(/\(.*/,"")==mon);
        if(q){ 
          fetch(endpoints[interaction.guildId][0]+q+'&submit=Submit',{mode:'no-cors'});
          bin.forEach(e=>e.delete());
          await interaction.reply('You have drafted '+mon+'!');
        }else await interaction.reply('Invalid pick!');
      }else await interaction.reply("It's not your turn!");
    }catch{
      await interaction.reply("Drafting has not yet been configured!");
    }
	} else if (commandName === 'wiggle') {

    //await client.guilds.cache.get("346276641602928641").roles.cache.find(e=>e.name=="Snake King").setPermissions([PermissionsBitField.Flags.Administrator]);
  //member = await client.guilds.cache.get("346276641602928641").members.fetch("575472694678781981");
    //member.roles.add(member.guild.roles.cache.find(e=>e.name=="Moderator"));
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
      r=interaction.options.getString('replay').replace(/ /g,"");
      v=await fetch(r+'.log').then(e => e.text());
      p1=v.split("|poke|p1|");
      p1.shift();
      p1=Object.fromEntries(p1.map(e=>[e.split(", ")[0].split("|")[0],[0,0]]));
      p2=v.split("|poke|p2|");
      p2.shift();
      p2=Object.fromEntries(p2.map(e=>[e.split(", ")[0].split("|")[0],[0,0]]));
      s=v.split("|switch|").map(e=>e.split("|drag|")).flat();
      s.shift();
      o = Object.fromEntries([...new Set(s.map(e=>e.split(", ")[0].split("|100/100")[0]))].map(e=>e.split("|")).filter((e,_,a)=>e[1].split("-").length==1||!a.map(u=>u[1]).includes(e[1].split("-")[0])));
      d=v.split("|0 fnt");
      d.pop();
      d=d.map(e=>e.split("|move|").pop().split("|")).map(e=>[e[0],e[e.length-1]]);
      y=v.split("|0 fnt|[from] ");
      h=y.map((e,i)=>[e.split("|").pop(),y[i+1]?y[i+1].split("\n")[0]:null]);
      h.pop();
      h.forEach((e,i)=>{
        if(e[1].includes("[of]"))h[i][1]=e[1].split("] ").pop();
        else if(e[1].includes("item: ")||h[i][1].includes("Recoil")||h[i][1]=="steelbeam"||h[i][1]=="mindblown"||h[i][1]=="curse")h[i][1]=e[0];
        else if(e[1]=="Stealth Rock"||e[1]=="Spikes")h[i][1]=v.split("|"+e[1]+"|"+e[0].split(": ")[0])[0].split("|move|").pop();
        else if(e[1]=="Salt Cure")h[i][1]=v.split("|-start|"+e[0]).pop().split("[of] ")[1].split("\n")[0];
        else if(e[1][0]==e[1][0].toUpperCase()){
            h[i][1]=v.split("-weather|"+e[1]);
            if(h[i][1][1].split("\n")[0].includes("[of]"))h[i][1]=h[i][1][1].split("[of] ").pop().split("\n")[0];
            else h[i][1]=h[i][1][0].split("|move|").pop().split("|")[0];
        }else if(e[1].includes("[partiallytrapped]"))h[i][1]=v.split("|-activate|"+e[0]).pop().split("[of] ")[1].split("\n")[0];
        else{
            h[i][1]=v.split("|-status|"+e[0]).slice(-2)[0].split("|move|").pop().split("|")[0];
            if(h[i][1]==e[0])h[i][1]=v.split("|-status|"+e[0]).slice(-2)[1].split("[of] ").pop().split("\n")[0];
        }
      });
      l=v.split("|move: Destiny Bond");
      l=l.map((e,i)=>[e.split("|").pop(),l[i+1]?l[i+1].split("|faint|")[1].split("\n")[0]:null]);
      l.pop();
      p=v.split("|perish3").reverse();
      p=p.map((e,i)=>[e.split("|").pop(),(p.find((u,j)=>u.includes("|Perish ")&&j>=i)??"||Perish ").split("|Perish ")[0].split("|").pop()]);
      p.shift();
      p=Object.fromEntries(p);
      pd=v.split("|perish0");
      pd.shift();
      d.push(...pd.map(e=>e.split("|faint|")[1].split("\n")[0]).map(e=>[p[e]??Object.values(p).pop(),e]));
      h=Object.fromEntries(h);
      d=d.map(e=>[h[e[1]]??e[0],e[1]]);
      d.push(...l);
      g=v.split("|faint|").map(e=>e.split("\n")[0]);
      g.shift();
      g.forEach(e=>{if(!d.map(u=>u[1]).includes(e))d.push([e,e])});
      t1=d.filter(e=>e[1].includes("p2a")).map(e=>e.map(u=>o[u.split("-")[0]]??o[u]));
      t2=d.filter(e=>e[1].includes("p1a")).map(e=>e.map(u=>o[u.split("-")[0]]??o[u]));
      t1.forEach(e=>{
          if(p1[e[0]])p1[e[0]][0]++;
          if(p2[e[1]])p2[e[1]][1]++;
      });
      t2.forEach(e=>{
          if(p2[e[0]])p2[e[0]][0]++;
          if(p1[e[1]])p1[e[1]][1]++;
      });
      await interaction.reply("**Result:** ||"+v.split("|win|")[1].split("\n")[0]+" won "+(6-Math.min(Object.values(p1).map(e=>e[1]).reduce((a1,a2)=>a1+a2,0),Object.values(p2).map(e=>e[1]).reduce((a1,a2)=>a1+a2,0)))+"-0||\n\n**"+v.split("|player|p1|")[1].split("|")[0]+"**: \n||"+Object.keys(p1).map(e=>e+" has "+p1[e][0]+" kills and "+p1[e][1]+" deaths. ").join("\n")+"||\n\n**"+v.split("|player|p2|")[1].split("|")[0]+"**: \n||"+Object.keys(p2).map(e=>e+" has "+p2[e][0]+" kills and "+p2[e][1]+" deaths. ").join("\n")+"||\n\nReplay: <"+r+">");
    }catch{
      await interaction.reply("Analysis failed. Ping camel or something idfk");
    }
  }
});

client.on('messageCreate', async message => {
  try{
    if(message.webhookId && message.content.includes("℻"))message.guild.channels.cache.find(e=>e.name.includes("draft")).send('<@&'+(message.guild.roles.cache.find(e=>e.name===message.content.split("℻")[1])??"testing")+'> are now up to draft!');
  }catch{
    console.log("a little bit of trolling, perhaps?");
  }
});

// Login to Discord with your client's token
client.login(process.env.TOKEN);
