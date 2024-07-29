// Require the necessary discord.js classes
const { Client, GatewayIntentBits, PermissionsBitField } = require('discord.js');
const fetch = require('node-fetch');
const http = require('http');
const proc = require('child_process');

// Pingable server to keep bot online
http.createServer(function (req, res) {
  res.writeHead(200, {'Content-Type': "text/plain"});
  res.write("Hello World!");
  res.end();
}).listen(8080);

// Create a new client instance
const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages] });

// Kill process on 429 error (improves stability on some providers)
var errorArray = [];
client.on("debug", function(info){
  errorArray.push(info);
  setTimeout(() => {
    if(errorArray.length < 3) {
      console.log("Caught a 429 error!"); 
      proc.exec("kill 1", (err) => {
        if(err) {
          console.error("Could not execute command: ", err);
          return
        }
        console.log("Kill 1 command succeeded");
      });
    }
  }, 20000);
});

// Store setTimeouts
var timer = {};

// Methods to utilize private channel as db
var db = {
  async search(sid) {
    if(!this.ids[sid]) return null;
    let m = await this.channel.messages.fetch(this.ids[sid]);
    if(m.embeds && m.content.length <= 2000) m.content += m.embeds.map(e => e.description + (e.footer ?? {text: ""}).text).join("");
    return m;
  },
  async add(sid, data) {
    data = data.join(",");
    let mid = await this.channel.send(data).then(e => e.id);
    if(Object.values(this.ids).length == 0) this.channel.send(sid + ":" + mid).then(e => e.pin());
    else {
      let m = await this.channel.messages.fetchPinned({limit: 1}).then(e => e.first());
      if(m.content.length + data.length > 2000) this.channel.send(sid + ":" + mid).then(e => e.pin());
      else m.edit(m.content + "," + sid + ":" + mid);
    }
    this.ids[sid] = mid;
  },
  async delete(sid) {
    await this.search(sid).then(e => e.delete());
    delete this.ids[sid];
    let m = await this.channel.messages.fetchPinned().then(e => e.find(u => u.content.includes(sid)));
    m.edit(m.content.replace(new RegExp("," + sid + ":[^,]*"), ""));
  },
  edit(data, storage, n) {
    if(!n) n = data.length;
    let s = storage.content.split(",");
    s.splice(s.indexOf(data.at(-1)) - n + 1, n, ...data);
    store(s.join(","), storage);
  }
}

// Handles storage up to 62000 characters
function store(s, storage) {
  let m = {
    content: s.slice(0, 2000),
    embeds: []
  }
  while(s.length > 2000) {
    m.embeds.push({
      description: s.slice(2000, 6000),
      footer: {
        text: s.slice(6000, 8000)
      }
    });
    s = s.slice(0, 2000) + s.slice(8000);
  }
  storage.edit(m);
}

// Get specified columns from Google Sheet
async function getData(sid, name, cols) {
  var d = await fetch("https://docs.google.com/spreadsheets/d/" + sid + "/gviz/tq?sheet=" + name + "&tqx=out:csv").then(e => e.text());
  return d.slice(1, -1).split('"\n"').map(e => e.split('","').slice(...cols)).flat();
}

// Send data to doc
function toDoc(form, data) {
  form = form.split("&");
  fetch("https://docs.google.com/forms/d/e/" + form[0] + "/formResponse?usp=pp_url&entry." + form[1] + "=" + encodeURIComponent(data) + "&submit=Submit", {mode: "no-cors"});
}

// Create an embed with components
function embed(comps, embeds) {
  return {
    components: comps.map(e => ({
      type: 1,
      components: e.map(u => u[0] < 3 ? {
        type: u[0],
        style: u[1],
        label: u[2],
        custom_id: u[2].toLowerCase(),
        disabled: false
      } : {
        type: u[0],
        placeholder: u[1],
        custom_id: u[1].toLowerCase(),
        options: u[2].map(l => ({
          label: l[0],
          value: l[1],
          default: l[2]
        }))
      })
    })),
    embeds: embeds.map(e => ({
      type: "rich",
      title: e[0],
      description: e[1],
      color: 0xFFFFFF,
      fields: e[2].map(u => ({
        name: u[0],
        value: u[1],
        inline: u[2]
      }))
    })),
    content: ""
  }
}

// Ephemeral version
function ephbed (comps, embeds) {
  let m = embed(comps, embeds);
  m.ephemeral = true;
  return m;
}

// Return a Porygon-esque analysis of a replay
async function analyze(r, sep) {
  const config = {
    setRecoil: ["steelbeam", "mindblown", "chloroblast", "curse", "highjumpkick", "jumpkick", "supercellslam"],
    hazards: ["Stealth Rock", "Spikes", "G-Max Steelsurge"],
    nonTrapDOT: ["Salt Cure", "Curse", "Leech Seed"]
  }
  try {
    // fetch replay log data, remove chat logs
    let v = await fetch(r + ".log").then(e => e.text());
    v = v.replace(/^\|c\|.*$/gm, "");
    // get mons from team preview
    let p1 = Object.fromEntries(v.split("|poke|p1|").slice(1).map(e => [e.split(", ")[0].split("|")[0], sep ? [0, 0, 0] : [0, 0]]));
    let p2 = Object.fromEntries(v.split("|poke|p2|").slice(1).map(e => [e.split(", ")[0].split("|")[0], sep ? [0, 0, 0] : [0, 0]]));
    // replace nicknames with actual names by looking at switches
    let d = "";
    while(true){
      let a = v.match(/switch\||drag\||replace\|/);
      if(!a) break;
      d += v.slice(0, a.index + a[0].length);
      v = v.slice(a.index + a[0].length);
      let m = v.split(/\|(.*)\n/, 2);
      m[1] = m[0].split(":")[0] + ": " + m[1].split(",")[0].split("|")[0];
      v = v.replaceAll(...m);
      if(a[0] == "replace|") {
        a = d.split(new RegExp("(switch\\||drag\\|)(" + m[0].slice(0, 2) + ".*?)\\|"));
        d = d.replace(a.at(-1), a.at(-1).replaceAll(a.at(-2), m[1]));
      }
    }
    v = d + v;
    // get all revealed mons if no teampreview
    if(!Object.values(p1).length) {
      p1 = Object.fromEntries([...new Set(v.split(/(?:switch\||drag\||replace\|)p1.: /).slice(1).map(e => e.split("|")[0]))].filter((e, _, a) => !e.includes("-") || !a.includes(e.split("-")[0])).map(e => [e, sep ? [0, 0, 0] : [0, 0]]));
      p2 = Object.fromEntries([...new Set(v.split(/(?:switch\||drag\||replace\|)p2.: /).slice(1).map(e => e.split("|")[0]))].filter((e, _, a) => !e.includes("-") || !a.includes(e.split("-")[0])).map(e => [e, sep ? [0, 0, 0] : [0, 0]]));
    }
    // get all direct kills, account for future sight and doom desire
    d = v.split("|0 fnt").slice(0, -1).map(e => e.split("|move|").pop().split("|")).map(e => e.includes("move: Future Sight\n") ? [v.split("|Future Sight|").at(-2).split("|").pop(), e[e.length - 1]] : (e.includes("move: Doom Desire\n") ? [v.split("|Doom Desire|").at(-2).split("|").pop(), e[e.length - 1]] : [e[0], e[e.length - 1]])).map((e, i, a) => [e[0] == "\n" ? a[i - 1][0] : e[0], e[1]]);
    // get all passive kills
    let h = Object.fromEntries(v.split("|0 fnt|[from] ").map((e, i, a) => i == a.length - 1 ? null : [e.split("|").pop(), (e => {
      // DOT non-trapping effects
      if(config.nonTrapDOT.includes(e[1].split("|")[0])) return (v.split("|-start|" + e[0]).at(-2) ?? e[0]).split("|move|").pop().split("|")[0];
      // credit stated in logs (ie. helmet)
      else if(e[1].includes("[of]")) return e[1].split("] ").pop();
      // item/move recoil (self KO)
      else if(e[1].includes("item: ") || e[1].toLowerCase().includes("recoil") || e[1] == "confusion" || config.setRecoil.includes(e[1])) return e[0];
      // hazard damage
      else if(config.hazards.includes(e[1])) return v.split(e[0] + "|0 fnt")[0].split(new RegExp("\\|\\-sidestart\\|" + e[0].split(/.: /)[0] + ": .*?" + e[1])).map(e => e.split("|Court Change|")).flat().at(-2).split("|move|").pop().split("|")[0];
      // weather damage
      else if(e[1][0] == e[1][0].toUpperCase()) {
        e[1] = v.split("-weather|" + e[1]);
        if(e[1][1].split("\n")[0].includes("[of]")) return e[1][1].split("[of] ").pop().split("\n")[0];
        else return e[1][0].split("|move|").pop().split("|")[0];
      // DOT trapping effects
      } else if(e[1].includes("[partiallytrapped]")) return v.split("|-activate|" + e[0]).pop().split("[of] ")[1].split("\n")[0];
      else {
        // flame/toxic orb
        if(v.split("|-status|" + e[0]).pop().split("item:")[0].length < 15) return e[0];
        else e[1] = (v.split("|-status|" + e[0].split("-")[0]).at(-2) ?? "h").split("|move|").pop();
        // toxic spikes/debris
        if(e[1].includes("|switch|")) return v.split(e[0] + "|0 fnt")[0].split(new RegExp("\\|\\-sidestart\\|" + e[0].split(/.: /)[0] + ": .*?\\|move: Toxic Spikes")).map(e => e.split("|Court Change|")).flat().at(-2).split("|move|").pop().split("|-activate|").pop().split("|")[0];
        else {
          // other status KO
          e[1] = e[1].split("|")[0];
          if(e[1] == e[0]) return v.split("|-status|" + e[0]).slice(-2)[1].split("[of] ").pop().split("\n")[0];
          return e[1];
        }
      }
    })([e.split("|").pop(), a[i + 1].split("\n")[0]])]).slice(0, -1));
    // destiny bond
    let l = v.split("|move: Destiny Bond").map((e, i, a) => [e.split("|").pop(), a[i + 1] ? a[i + 1].split("|faint|")[1].split("\n")[0] : null]).slice(0, -1);
    // perish song/body
    let p = Object.fromEntries(v.split("|perish3").reverse().map((e, i, a) => [e.split("|").pop(), (a.find((u, j) => u.includes("|Perish ") && j >= i) ?? "||Perish ").split("|Perish ")[0].split("|").pop()]).slice(1));
    let pd = v.split("|perish0").slice(1);
    // instant self KOs (ie. healing wish)
    let g = v.split("|faint|").map(e => e.split("\n")[0]).slice(1);
    // create separate list for all passive kills, otherwise add to direct
    if(sep) {
      var pas = [];
      pas.push(...pd.map(e => e.split("|faint|")[1].split("\n")[0]).map(e => [p[e] ?? Object.values(p).pop(), e]));
      let len = d.length;
      [...d].reverse().forEach((e, i) => {
        if(h[e[1]]) {
          d.splice(len - i - 1, 1);
          pas.push([h[e[1]], e[1]]);
        }
      });
      pas.push(...l);
      g.forEach(e => {
        if(!d.map(u => u[1]).includes(e) && !pas.map(u => u[1]).includes(e)) d.push([e, e]);
      });
    } else {
      d.push(...pd.map(e => e.split("|faint|")[1].split("\n")[0]).map(e => [p[e] ?? Object.values(p).pop(), e]));
      d = d.map(e => [h[e[1]] ?? e[0], e[1]]);
      d.push(...l);
      g.forEach(e => {
        if(!d.map(u => u[1]).includes(e)) d.push([e, e]);
      });
    }
    // clean up unknown formes in team preview
    Object.keys(p1).filter(e => e.includes("*")).forEach(e => {
      let m = v.match(new RegExp("p1.: " + e.slice(0, -2) + ".*?\\|100"));
      if(m) delete Object.assign(p1, {
        [m[0].split(", ")[0].split("|")[0].slice(5)]: p1[e]
      })[e];
    });
    Object.keys(p2).filter(e => e.includes("*")).forEach(e => {
      let m = v.match(new RegExp("p2.: " + e.slice(0, -2) + ".*?\\|100"));
      if(m) delete Object.assign(p2, {
        [m[0].split(", ")[0].split("|")[0].slice(5)]: p2[e]
      })[e];
    });
    // count kills and deaths
    d.forEach(e => {
      let m = [e[0][1], e[1][1]];
      e = e.map(u => u.replace(/p..: /, ""));
      (m[1] == "2" ? (p2[e[1]] ? p2[e[1]] : p2[e[1].split("-")[0]]) : (p1[e[1]] ? p1[e[1]] : p1[e[1].split("-")[0]]))[1]++;
      if(m[1] == m[0]) return;
      (m[0] == "2" ? (p2[e[0]] ? p2[e[0]] : p2[e[0].split("-")[0]]) : (p1[e[0]] ? p1[e[0]] : p1[e[0].split("-")[0]]))[0]++;
    });
    // repeat for passive kills if separate
    if(sep) pas.forEach(e => {
      let m = [e[0][1], e[1][1]];
      e = e.map(u => u.replace(/p..: /, ""));
      (m[1] == "2" ? (p2[e[1]] ? p2[e[1]] : p2[e[1].split("-")[0]]) : (p1[e[1]] ? p1[e[1]] : p1[e[1].split("-")[0]]))[1]++;
      if(m[1] == m[0]) return;
      (m[0] == "2" ? (p2[e[0]] ? p2[e[0]] : p2[e[0].split("-")[0]]) : (p1[e[0]] ? p1[e[0]] : p1[e[0].split("-")[0]]))[2]++;
    });
    // calculate diff (accounting for forfeits)
    l = v.split(/\|\-heal\|(.*)\|50\/100\|\[from\] move: Revival Blessing/).filter((_, i) => i % 2);
    d = v.split(" forfeited.\n|\n|win|");
    if(d.length > 1) {
      h = v.split("|" + d.pop().split("\n")[0])[0].split("|").pop();
      h = v.split(v.includes("|teampreview|") ? "|teampreview|" : "|teamsize|" + h + "|")[1].split("\n")[0] - Object.values(h == "p1" ? p1 : p2).map(e => e[1]).reduce((a1, a2) => a1 + a2, 0) + (h == "p1" ? 1 : -1) * (l.filter(e => e.includes("p1")).length - l.filter(e => e.includes("p2")).length);
    }else h = Math.abs(Object.values(p1).map(e => e[1]).reduce((a1, a2) => a1 + a2, 0) - l.filter(e => e.includes("p1")).length - Object.values(p2).map(e => e[1]).reduce((a1, a2) => a1 + a2, 0) + l.filter(e => e.includes("p2")).length);
    // send results
    v = `**Result:** ||${v.split("|win|")[1].split("\n")[0]} won ${h}-0||

**${v.split("|player|p1|")[1].split("|")[0]}**: 
||${Object.keys(p1).map(e => `${e} has ${p1[e][0]} ${sep ? `direct kills, ${p1[e][2]} passive kills,` : `kills`} and ${p1[e][1]} deaths. `).join("\n")}||

**${v.split("|player|p2|")[1].split("|")[0]}**: 
||${Object.keys(p2).map(e => `${e} has ${p2[e][0]} ${sep ? `direct kills, ${p2[e][2]} passive kills,` : `kills`} and ${p2[e][1]} deaths. `).join("\n")}||

Replay: <${r}>`;
    // add warning if illusion mon detected
    if([...Object.keys(p1), ...Object.keys(p2)].find(e => e.includes("Zor"))) v = "*Warning: Illusion mon detected. Manually adjusting kills is advised.*\n" + v;
    return v;
  } catch {
    return null;
  }
}

// Check if pick is legal
function validate(mon, data, rules, tL, draft, n) {
  // was it drafted?
  if(draft.map(e => e.toLowerCase()).includes(mon.toLowerCase())) return ["This mon has already been drafted.", "Please check the doc to see the list of available mons."];
  // is it on the tierlist?
  let mons = draft.filter((_,i) => data[i * 2 + 3] == data[n]).filter(Boolean);
  mon = tL.find(e => e[0].toLowerCase() == mon.toLowerCase());
  if(!mon || mon[1] == "") return ["This pick is invalid.", "Please check the doc to see the list of available mons."];
  // is it banned?
  else if(mon[1] == "X") return ["This pick is banned.", "Please check the doc to see the list of available mons."];
  // does it violate species clause?
  else if(rules[0][1] == "true" && mons.map(e => e.split("-")[0]).includes(mon[0].split("-")[0])) return ["This pick violates species clause.", "Please select a mon that does not have the same dex number as another mon on your roster."];
  let points = parseInt(data[0].replace("Points: ", "")) - mons.filter(Boolean).reduce((a, b) => a + parseInt((tL.find(u => u[0] == b) ?? [, 0])[1]), 0);
  let rem = data[1] - mons.length - 1;
  let lowCap = new Array(rem).fill(Infinity);
  let t = tL.map(e => draft.includes(e[0]) ? Infinity : e[1]);
  for(let i = 1; i < rules.length; ++i) {
    // does it exceed the mega cap?
    if(rules[i][0] == "megas" && mons.filter(e => e.includes("-Mega")).length >= rules[i][1] && mon[0].includes("-Mega")) return ["This pick exceeds the mega cap.", "Please select a mon that is not a mega evolution."];
    else if(rules[i][0] == "minlength") rem = rules[i][1] - mons.length - 1;
    // does it violate cap rules?
    else if(rules[i][0] == "cap") {
      let tiers = rules[i][1].split(",");
      t = t.filter(e => !tiers.includes(e));
      let diff = tiers.reduce((a, b) => a + mons.filter(e => (tL.find(u => u[0] == e) ?? [, 0])[1] == b).length, 0);
      if(!tiers.includes(mon[1]) && data[1] - mons.length <= rules[i][2] - diff) return ["This pick violates a cap rule.", "You must draft at least " + rules[i][2] + " mons from the following tiers: " + tiers.join(", ") + "."];
      else if(tiers.includes(mon[1]) && diff >= rules[i][3]) return ["This pick violates a cap rule.", "You may only draft " + rules[i][3] + " mons from the following tiers: " + tiers.join(", ") + "."];
      // account for caps in checking minimum allowance
      let low = Math.min(...tiers);
      for(let j = 0; j < rem && j < rules[i][3] - diff; j++) {
        let k = lowCap.length - j - 1;
        if(low < lowCap[k]) lowCap[k] = low;
      }
      lowCap.sort();
      t = t.filter(e => !tiers.includes(e.toString()));
    }
  }
  t = t.map(e => !e || e == "X" ? Infinity : isNaN(e) ? 0 : parseInt(e)).sort((a, b) => a - b);
  // check minimum allowance
  let diff = 0;
  for(let i = 0; i < rem; i++) {
    if(lowCap[0] < t[0]) diff += lowCap.shift();
    else diff += t.shift();
  }
  // does it cost too much?
  if(points < mon[1]) return ["This pick costs too much.", "Please select a mon that is within your budget."];
  else if(points - diff < mon[1]) return ["This pick costs too much.", "While you have enough points to draft this mon, you would not have enough to complete your draft. Please select a mon that is within your budget."];
  return mon[0];
}

// Draft a mon
async function draft(s, mon, end, storage, v) {
  if(!end.guild.members.me.permissionsIn(end.channel ?? end).has(PermissionsBitField.Flags.SendMessages)) {
    if(end.channel) end.editReply(embed([], [["Invalid Permissions", "I do not have Send Messages perms in this channel. Please change this, or draft in another channel.", []]]));
    return;
  }
  if(!storage) {
    storage = await db.search(end.guildId);
    if(!storage) return;
  }
  // get correct div if applicable
  if(v) {
    for(var n = 0; s[3 + n] && (!s[3 + n].includes(v) || s[3 + n][0] == "℻"); n += 4);
    if(!s[3 + n]) {
      end.editReply(embed([], [["You are not part of this draft.", "If this is a mistake, ask an admin to add you to the draft.", []]]));
      return;
    }
    s = s.slice(n, n + 8);
  } else {
    if(storage.embeds && storage.content.length <= 2000) storage.content += storage.embeds.map(e => e.description + (e.footer ?? {text: ""}).text).join("");
    s = storage.content.split(",").splice(storage.content.split(",").indexOf(s[7]) - 7, 8);
  }
  if(s[6] != "draft") {
    if(end.channel) end.editReply(embed([],[["The draft has been paused.","Please wait until the draft is unpaused to use this command.",[]]]));
    return;
  }
  // check if enough time has passed since previous pick
  if(!timer[end.guildId + ":" + s[7]]) {
    if(end.channel) end.editReply(embed([], [["A pick has just been made.", "Please wait a second, then use the command again.", []]]));
    return;
  }
  try {
    // validate pick
    let data = await getData(s[0], "Wiglett", [1, 3]);
    n = data.indexOf("") + 1;
    let teams = s[3].split("&").map(e => e.split("/"));
    let tL = await getData(s[0], "WiglettDex", [1, 4]);
    tL = tL.filter((_, i) => i % 3 == 2).map((e, i) => [e, tL[i * 3]]).slice(2);
    let rules = s[2].split("&").map(e => e.replaceAll("/", ",").split(" "));
    let draft = data.slice(2).filter((_,i) => i % 2 == 0);
    if(v) {
      if(v != teams[data[n] - 1][0]) {
        end.editReply(embed([], [["It's not your turn.", "If you wish to leave a pick for your next turn, use the /leavepick command.", []]]));
        return;
      }
      mon = validate(mon, data, rules, tL, draft, n);
      if(typeof mon != "string") {
        end.editReply(embed([], [[...mon, []]]));
        return;
      }
    }
    // check for left picks
    let next, out = "";
    let mons = [mon];
    draft.push(mon);
    while(true){
      next = teams[data[n + 2] - 1];
      if(!next) break;
      let points = parseInt(data[0].replace("Points: ", "")) - draft.filter((_, i) => data[i * 2 + 3] == data[n]).filter(Boolean).reduce((a, b) => a + parseInt((tL.find(u => u[0] == b) ?? [, 0])[1]), 0);
      if(points <= 0) next[1] = "---";
      if(next[1]) {
        if(next[1] != "---" && typeof validate(next[1], data, rules, tL, draft, n + 2) != "string") {
          if(typeof validate(next[2], data, rules, tL, draft, n + 2) != "string") break;
          mon = next[2];
        } else mon = next[1];
        // add if valid pick
        teams[data[n + 2] - 1] = [next[0], ...next.slice(3), "", ""];
        mons.push(mon);
        draft.push(mon);
        out += "<@" + next[0] + "> drafted " + mon + "!\n";
        n += 2;
      }else break;
    }
    // report and update picks
    toDoc(s[1], mons.map(e => "draft," + e).join(";"));
    if(end.channel) {
      end.editReply(embed([], [["You drafted " + mons[0] + "!", out, []]]));
      end = end.channel;
    } else end.send(embed([], [["Pick skipped due to timer!", out, []]]));
    if(!next) {
      if(!isNaN(timer[end.guildId + ":" + s[7]])) clearTimeout(timer[end.guildId + ":" + s[7]]);
      setTimeout(() => end.send("The draft is over!"), 500);
      setTimeout(() => toDoc(s[1], "end"), 1000);
      db.edit([...s.slice(0, 3), s[7]], storage, s.length);
    } else {
      teams[data[n + 2] - 1] = [next[0], ...next.slice(3), "", ""];
      s[3] = teams.map(e => e.join("/")).join("&");
      if(!isNaN(timer[end.guildId + ":" + s[7]])) clearTimeout(timer[end.guildId + ":" + s[7]]);
      timer[end.guildId + ":" + s[7]] = null;
      db.edit([...s.slice(0, 5), end.id + "&" + new Date().valueOf(), "draft", s[7]], storage);
      setTimeout(() => startTimer(end.guildId, s, new Date().valueOf(), end, storage), 1500);
      setTimeout(async () => end.send("Next pick is <@" + next[0] + ">!"), 500);
    }
  } catch {
    end.editReply(embed([], [["Something went wrong.", "There is likely a problem with the doc. This issue must be resolved before the draft can continue.", []]]));
    return;
  }
}

// Start setTimeouts
function startTimer(id, s, m, channel, storage) {
  if(s[4]) {
    let t = s[4] * 60000 - new Date().valueOf() + parseInt(m);
    if(t > 0) timer[id + ":" + s[7]] = setTimeout(() => draft(s, "---", channel, null, false), t);
    else {
      timer[id + ":" + s[7]] = "n";
      draft(s, "---", channel, null, false);
    }
  } else timer[id + ":" + s[7]] = "n";
}

// Division selection menu
async function getDiv(s, interaction) {
  let divs = s.filter(e => e[0] == "℻").map((e, i) => [e.slice(1), i.toString(), false]);
  if(divs.length < 2) return s;
  const res = await interaction.editReply(embed([[[3, "Division", divs]]], [["Select a division:", "", []]]));
  const collect = res.createMessageComponentCollector({componentType: 3, time: 60000});
  return await new Promise(r => {
    collect.on("collect", async e => {
      let n = e.values[0] > 0 ? s.indexOf("℻" + divs[e.values[0] - 1][0]) : -1;
      collect.stop("done");
      e.deferUpdate();
      let storage = await db.search(interaction.guildId);
      s = storage.content.split(",");
      r(s.slice(n + 1, s.indexOf("℻" + divs[e.values[0]][0]) + 1));
    });
    collect.on("end", (_, e) => {
      if(e != "done") {
        interaction.editReply(embed([], [["No selection was made within one minute.", "", []]]));
        r(false);
      }
    });
  });
}

// Prepare bot when client is ready
client.once("ready", async () => {
  db.channel = await client.channels.cache.get(process.env.DATABASE);
  db.ids = await db.channel.messages.fetchPinned().then(m => Object.fromEntries(m.map(e => e.content.split(",").map(u => u.split(":"))).flat()));
  // restart timers
  for(let id in db.ids) {
    try {
      let storage = await db.search(id);
      let d = storage.content.split(",");
      d.filter(e => e[0] == "℻").map((e, i, a) => {
        let n = i > 0 ? d.indexOf(a[i - 1]) : -1;
        return d.slice(n + 1, d.indexOf(e) + 1);
      }).forEach(async s => {
        if(s[4] && s[5]) {
          let m = s[5].split("&");
          m[0] = await client.channels.cache.get(m[0]);
          startTimer(id, s, m[1], m[0], storage);
        }else timer[id + ":" + s[7]] = "n";
      });
    } catch(err) {
      console.log(err);
    }
  }
  client.user.setPresence({
    status: "online",
    activities: [{
      name: "/guide",
      type: 3
    }]
  });
  console.log("Ready!");
});

// Handle interactions
client.on("interactionCreate", async interaction => {
  if (!interaction.isChatInputCommand()) return;

  const { commandName } = interaction;
  
  try {
    
    if (commandName === "draft") {
      
      await interaction.deferReply();
      // get storage and draft
      let storage = await db.search(interaction.guildId);
      if(!storage) {
        interaction.editReply(embed([],[["The draft is not ongoing.","Please wait until the draft has started to use this command.",[]]]));
        return;
      }
      let s = storage.content.split(",");
      let mon = interaction.options.getString("mon");
      draft(s, mon, interaction, storage, interaction.user.id);
      return;

    } else if(commandName === "draftmod") {
      
      await interaction.deferReply();
      // get storage
      let storage = await db.search(interaction.guildId);
      if(!storage) {
        interaction.editReply(embed([], [["Doc not found.", "Please use the /doc command before managing the draft.", []]]));
        return;
      }
      let s = await getDiv(storage.content.split(","), interaction);
      if(!s) return;
      if(!s[0]) {
        interaction.editReply(embed([], [["Doc not found.", "Please use the /doc command before managing the draft.", []]]));
        return;
      }
      // handle actions
      let action = interaction.options.getInteger("action");
      if(action == 0) {
        if(!interaction.guild.members.me.permissionsIn(interaction.channel).has(PermissionsBitField.Flags.SendMessages)) {
          interaction.editReply(embed([], [["Invalid Permissions", "I do not have Send Messages perms in this channel. Please change this before starting the draft.", []]]));
          return;
        }
        try {
          // start draft
          let data = await getData(s[0], "Wiglett", [1, 4]);
          if(s[6] == "pause") {
            startTimer(interaction.guildId, s, new Date().valueOf(), interaction.channel, storage);
            db.edit([...s.slice(0, -3), interaction.channel.id + "&" + new Date().valueOf(), "draft", s[7]], storage);
            interaction.editReply(embed([], [["The draft has been unpaused.", "Next pick is <@" + s[3].split("&").map(e => e.split("/")[0])[data[data.indexOf("") + 1] - 1] + ">!", []]]));
            return;
          }
          data = data[2];
          if(data > 24) {
            interaction.editReply(embed([], [["There are too many players in this draft.", "The current limit for players per division is 24. Please create a new division to add more players.", []]]));
            return;
          }
          let menu = embed([[[2, 3, "Start"], [2, 4, "Cancel"]]], 
                           [["Select " + data + " users to begin the draft.", "Make sure to select them **in draft order**. If you were expecting a different number, cancel and check the Wiglett tab of the doc.", []]]);
          menu.components.splice(0, 0, {type: 1, components: [{
            type: 5,
            custom_id: "user_select",
            min_values: data,
            max_values: data
          }]});
          menu.components[1].components[0].disabled = true;
          const res = await interaction.editReply(menu);
          const collect = res.createMessageComponentCollector({componentType: 5, time: 120000});
          let teams = [];
          collect.on("collect", async e => {
            teams = e.values;
            menu.components[1].components[0].disabled = false;
            await e.update(menu);
          });
          try {
            const next = await res.awaitMessageComponent({filter: e => e.user.id == interaction.user.id && e.customId.length < 10, time: 120000});
            if(next.customId == "start") {
              interaction.editReply(embed([], [["The draft has started.", "", []]]));
              interaction.channel.send("First pick is <@" + teams[0] + ">!");
              db.edit([...s.slice(0, 3), teams.map(e => e + "////").join("&"), "", interaction.channel.id + "&" + new Date().valueOf(), "draft", s.at(-1)], storage, s.length);
              timer[interaction.guildId + ":" + s.at(-1)] = "n";
              return;
            } else {
              interaction.editReply(embed([], [["The draft was not started.", "Please re-use the command if you still wish to start the draft.", []]]));
              return;
            }
          } catch {
            // timeout after 2 minutes
            interaction.editReply(embed([], [["No selection was made within two minutes.", "Please re-use the command if you still wish to start the draft.", []]]));
            return;
          }
        } catch {
          interaction.editReply(embed([], [["Something went wrong.", "There is likely a problem with the doc. Please resolve this issue before starting the draft.", []]]));
          return;
        }
      } else if(s[6] != "draft") {
        interaction.editReply(embed([], [["The draft is not ongoing.", "Use /draftmod start to start the draft.", []]]));
        return;
      } else if(action == 1) {
        // pause draft
        if(!isNaN(timer[interaction.guildId + ":" + s[7]])) clearTimeout(timer[interaction.guildId + ":" + s[7]]);
        db.edit([...s.slice(0, -3), "", "pause", s[7]], storage);
        interaction.editReply(embed([], [["The draft has been paused!", "Use /draftmod start to unpause the draft. If there was a timer, it will be reset upon unpausing.", []]]));
        return;
      } else if(action == 2) {
        // end draft
        if(interaction.options.getString("data") != "end") interaction.editReply(embed([], [["Are you sure you want to end the draft?", "If so, re-use this command and set the data parameter to end (this is to prevent people from accidentally ending the draft).", []]]));
        else {
          db.edit([...s.slice(0, 3), s[7]], storage, s.length);
          toDoc(s[1], "end");
          if(!isNaN(timer[interaction.guildId + ":" + s[7]])) clearTimeout(timer[interaction.guildId + ":" + s[7]]);
          interaction.editReply(embed([], [["The draft is over!", "", []]]));
        }
        return;
      } else if(action == 3 || action == 4) {
        // skip or force draft
        draft(s, action == 3 ? (interaction.options.getString("data") ?? "---") : "---", interaction, storage, false);
        return;
      } else if(action == 5) {
        // replace coach
        let menu = embed([[[2, 3, "Replace"],[2, 4, "Cancel"]]],
                         [["Replace Coach", "Select the coach to be replaced, and the coach to replace them with.", []]]);
        menu.components.splice(0, 0, {type: 1, components: [{
          type: 5,
          custom_id: "user_select",
          min_values: 2,
          max_values: 2
        }]});
        menu.components[1].components[0].disabled = true;
        const res = await interaction.editReply(menu);
        const collect = res.createMessageComponentCollector({componentType: 5, time: 120000});
        let teams = [];
        collect.on("collect", async e => {
          teams = e.values;
          menu.components[1].components[0].disabled = false;
          await e.update(menu);
        });
        try {
          const next = await res.awaitMessageComponent({filter: e => e.user.id == interaction.user.id && e.customId.length < 10, time: 60000});
          if(next.customId == "replace") {
            if(storage.embeds && storage.content.length <= 2000) storage.content += storage.embeds.map(e => e.description + (e.footer ?? {text: ""}).text).join("");
            s = storage.content.split(",").splice(storage.content.split(",").indexOf(s[7]) - 7, 8);
            let t = s[3].split("&").map(e => e.split("/"));
            let m = t.find(e => e[0] == teams[0]);
            if(m) {
              if(t.find(e => e[0] == teams[1])) {
                interaction.editReply(embed([], [["Both coaches are in this draft.", "Please select a coach that is not in this draft to replace with.", []]]));
                return;
              }
              m[0] = teams[1];
            } else {
              m = t.find(e => e[0] == teams[1]);
              if(m) m[0] = teams[0];
              else {
                interaction.editReply(embed([], [["Neither coach is in this draft.", "Please select a coach that is in the draft, and another coach to replace them with.", []]]));
                return;
              }
            }
            db.edit([...s.slice(0, 3), t.map(e => e.join("/")).join("&"), ...s.slice(4)], storage);
            interaction.editReply(embed([], [["The coach has been replaced.", "If it was the replaced coach's turn, the new coach may now draft.", []]]));
            return;
          } else {
            interaction.editReply(embed([], [["No coaches were replaced.", "Please re-use the command if you still wish to replace a coach.", []]]));
            return;
          }
        } catch {
          // timeout after 1 minute
          interaction.editReply(embed([], [["No selection was made within one minute.", "Please re-use the command if you still wish to replace a coach.", []]]));
          return;
        }
      } else {
        // set timer
        let data = interaction.options.getString("data") ?? "off";
        if(data.toLowerCase() == "off") {
          if(timer[interaction.guildId + ":" + s[7]]) clearTimeout(timer[interaction.guildId + ":" + s[7]]);
          db.edit([...s.slice(0, 4), "", s[5], s[6], s[7]], storage);
          interaction.editReply(embed([], [["The timer has been turned off.", "Re-use this command if you wish to turn the timer back on.", []]]));
          return;
        }
        if(isNaN(data) || data < 5) {
          interaction.editReply(embed([], [["Invalid timer.", "Please ensure the data parameter is 5 minutes or greater.", []]]));
          return;
        }
        s[4] = data;
        db.edit(s, storage);
        let m = s[5].split("&");
        m[0] = await client.channels.cache.get(m[0]);
        if(!isNaN(timer[interaction.guildId + ":" + s[7]])) clearTimeout(timer[interaction.guildId + ":" + s[7]]);
        startTimer(interaction.guildId, s, m[1], m[0], storage);
        interaction.editReply(embed([], [["The timer is now " + data + " minutes.", "Use /draftmod timer off if you wish to stop the timer.", []]]));
        return;
      }

    } else if (commandName === "leavepick") {
      
      await interaction.deferReply({ephemeral: true});
      // get storage
      let storage = await db.search(interaction.guildId);
      if(!storage) {
        interaction.editReply(ephbed([], [["The draft is not ongoing.", "Please wait until the draft has started to use this command.", []]]));
        return;
      }
      // get correct div
      let s = storage.content.split(",");
      for(var n = 0; s[3 + n] && (!s[3 + n].includes(interaction.member.user.id) || s[3 + n][0] == "℻"); n += 4);
      if(!s[3 + n]) {
        interaction.editReply(ephbed([], [["You are not part of this draft.", "If this is a mistake, ask an admin to add you to the draft.", []]]));
        return;
      }
      s = s.slice(n, n + 8);
      // validate pick
      let mon = interaction.options.getString("mon").replace(/,|&|\//g, "");
      try {
        var data = await getData(s[0], "Wiglett", [1, 3]);
        var teams = s[3].split("&").map(e => e.split("/"));
        n = teams.findIndex(e => e[0] == interaction.member.user.id);
        let tL = await getData(s[0], "WiglettDex", [1, 4]);
        tL = tL.filter((_, i) => i % 3 == 2).map((e, i) => [e, tL[i * 3]]);
        let rules = s[2].split("&").map(e => e.replaceAll("/", ",").split(" "));
        let draft = data.slice(2).filter((_,i) => i % 2 == 0);
        if(mon.toLowerCase() != "cancel") {
          mon = validate(mon, data, rules, tL, draft, data.slice(2).indexOf((n + 1).toString()) + 2);
          if(typeof mon != "string") {
            interaction.editReply(ephbed([], [[...mon, []]]));
            return;
          }
        }
      } catch {
        interaction.editReply(ephbed([], [["Something went wrong.", "There is likely a problem with the doc. This issue must be resolved before picks can be left.", []]]));
        return;
      }
      // prompt for pick slot, update
      let types = ["Next", "Next (Backup)", "Following", "Following (Backup)"];
      let picks = teams[n].slice(1).map((e, i) => e ? types[i] + " - " + e : null).filter(Boolean).join("\n");
      const res = await interaction.editReply(ephbed([types.map((e, i) => [2, 1 + i % 2, e])],[[mon.toLowerCase() == "cancel" ? "Select slot to cancel:" : "Select slot to leave " + mon + " in:", picks, []]]));
      types = types.map(e => e.toLowerCase());
      try {
        const confirm = await res.awaitMessageComponent({filter: e => e.user.id == interaction.user.id, time: 60000});
        if(storage.embeds && storage.content.length <= 2000) storage.content += storage.embeds.map(e => e.description + (e.footer ?? {text: ""}).text).join("");
        s = storage.content.split(",").splice(storage.content.split(",").indexOf(s[7]) - 7, 8);
        teams = s[3].split("&").map(e => e.split("/"));
        if(mon.toLowerCase() == "cancel") {
          teams[n][types.indexOf(confirm.customId) + 1] = "";
          confirm.update(ephbed([], [["You cancelled your " + confirm.customId + " pick!", "Re-use the command if you wish to leave a different pick.", []]]))
        } else {
          teams[n][types.indexOf(confirm.customId) + 1] = mon;
          confirm.update(ephbed([], [["You left " + mon + " as your " + confirm.customId + " pick!", "Use /leavepick cancel if you need to cancel this pick.", []]]));
        }
        db.edit([...s.slice(0, 3), teams.map(e => e.join("/")).join("&"), s[4], s[5], "draft", s[7]], storage);
        return;
      } catch {
        // timeout after 1 minute
        interaction.editReply(ephbed([], [["Confirmation was not received within one minute.", "Please re-use the command if you still wish to leave a pick.", []]]));
        return;
      }

    } else if (commandName === 'wiggle') {

      // joke ping command
      // let storage = await db.search(interaction.guildId);
      await interaction.reply("Your IP address is not " + (Math.floor(Math.random() * 255) + 1) + "." + (Math.floor(Math.random() * 255)) + "." + (Math.floor(Math.random() * 255)) + "." + (Math.floor(Math.random() * 255)));
      return;

    } else if(commandName === "analyze") {

      // get analysis
      let out = await analyze(interaction.options.getString("replay").replace(/ /g, "").split("?")[0], interaction.options.getBoolean("passive"));
      // send if successful
      if(out) interaction.reply(embed([], [["Replay Analysis", out, []]]));
      else interaction.reply(embed([], [["Analysis failed.", "Make sure your replay link is valid.", []]]));
      return;

    } else if(commandName === "submit") {
      
      await interaction.deferReply();
      try {
        //get list of mons and teams
        let storage = await db.search(interaction.guildId);
        if(!storage) {
          interaction.editReply(embed([], [["Doc not found.", "Please use the /doc command before submitting any matches.", []]]));
          return;
        }
        let s = await getDiv(storage.content.split(","), interaction);
        if(!s) return;
        if(!s[0]) {
          interaction.editReply(embed([], [["Doc not found.", "Please use the /doc command before submitting any matches.", []]]));
          return;
        }
        let data = await getData(s[0], "WiglettMatches", [5, 7]);
        var n = [...new Set(data.filter((_, i) => i % 2).filter(Boolean))];
        data = data.filter(Boolean);
        let r = "r";
        if(!interaction.options.getInteger("type")) { // replay submission
          // get replay analysis
          r = interaction.options.getString('replay');
          if(!r) {
            interaction.editReply(embed([], [["Replay link is missing.", "Please paste it into the replay parameter of this command.", []]]));
            return;
          }
          r = r.replace(/ /g, "").split("?")[0];
          let analysis = await analyze(r, s[2].includes("countpassive true"));
          // check if invalid or illusion
          let submit = true;
          if(!analysis) {
            interaction.editReply(embed([], [["Analysis failed.", "Make sure your replay link is valid.", []]]));
            return;
          } else if(analysis[1] != "*") {
            analysis = analysis.split("*\n")[1];
            submit = false;
          }
          // extract raw stats from analysis
          var d = analysis.split("\n").slice(3);
          let z = d.indexOf("");
          d = [...d.slice(0, z), ...d.slice(z + 2, -2)].map(e => e.replace("||", "").split(" has ")).map(e => [e[0], ...e[1].split(" ").filter(u => !isNaN(u))].slice(0, -1));
          // determine teams in replay
          let t = d.map(e => data[data.indexOf(e[0]) + 1]);
          t = [t.slice(0, z), t.slice(z)].map(e => e.reduce((a, b, _, v) => v.filter(u => u == a).length < v.filter(u => u == b).length ? b : a));
          var p1 = data.slice(2).filter((_, i, a) => a[i + 1] == t[0]);
          var p2 = data.slice(2).filter((_, i, a) => a[i + 1] == t[1]);
          d = [...d.slice(0, z).map(e => p1.includes(e[0]) ? e : [p1.find(u => e[0].split("-")[0] == u.split("-")[0]) ?? e[0], ...e.slice(1)]), ...d.slice(z).map(e => p2.includes(e[0]) ? e : [p2.find(u => e[0].split("-")[0] == u.split("-")[0]) ?? e[0], ...e.slice(1)])];
          // swap teams if winner is not first
          var w = analysis.split("**");
          if(w[3] != w[2].slice(3).match(/(.*) won /)[1]) t.reverse();
          if(submit || s[2].includes("countpassive true")) {
            // get confirmation
            const res = await interaction.editReply(embed([[[2, 3, "Submit"], [2, 4, "Cancel"]]],
                                                          [["Submit this match?", submit ? "" : "This replay contains a mon with Illusion. Stats should be verified and edited via WiglettData if necessary.", [["Winner:", t[0], true], ["Loser:", t[1], true], ["Analysis:", analysis.replaceAll("||",""), false]]]]));
            try {
              const confirm = await res.awaitMessageComponent({filter: e => e.user.id == interaction.user.id, time: 60000});
              if(confirm.customId == "submit") {
                // send results to doc
                toDoc(s[1], ["match", n.indexOf(t[0]), n.indexOf(t[1]), analysis.split("-0||")[0].split(" ").pop(), r, ...d.map(e => e.slice(1).join("") + e[0])].join(","));
                confirm.update(embed([], [["The match has been submitted!", "Check the doc for updated stats.", []]]));
                return;
              } else {
                // cancel
                confirm.update(embed([], [["Submission has been cancelled.", "", []]]));
                return;
              }
            } catch {
              // timeout after 1 minute
              interaction.editReply(embed([], [["Confirmation was not received within one minute.", "Please re-use the command if you still wish to submit.", []]]));
              return;
            }
          } else {
            const res = await interaction.editReply(embed([[[2, 3, "Continue"], [2, 4, "Cancel"]]],
                                                          [["Manually edit stats?", "This replay contains a mon with Illusion. Stats must be verified and adjusted before submitting.", []]]));
            try {
              const confirm = await res.awaitMessageComponent({filter: e => e.user.id == interaction.user.id, time: 60000});
              if(confirm.customId != "continue") {
                // cancel
                confirm.update(embed([], [["Submission has been cancelled.", "", []]]));
                return;
              }
              confirm.deferUpdate();
            } catch {
              // timeout after 1 minute
              interaction.editReply(embed([], [["Confirmation was not received within one minute.", "Please re-use the command if you still wish to submit.", []]]));
              return;
            }
            p1 = d.slice(0, z).map(e => [e[0], ...e.slice(1).map(u => parseInt(u)), true]);
            p2 = d.slice(z).map(e => [e[0], ...e.slice(1).map(u => parseInt(u)), true]);
            if(w[3] != w[2].slice(3).match(/(.*) won /)[1]) {
              w = p1;
              p1 = p2;
              p2 = w;
            }
            w = n.indexOf(t[0]);
            var l = n.indexOf(t[1]);
            d = "auto diff";
          }
        }
        if(interaction.options.getInteger("type")) { // manual submission
          // get list of unique teams
          var t = n.slice(1).map((e, i) => [e, (i + 1).toString(), false]);
          // create menu for selecting teams + diff
          const menu = await interaction.editReply(embed([[[3, "Winning Team", t]], [[3, "Losing Team", t]], [[2, 1, "Auto Diff"], [2, 2, "2 - 0"], [2, 2, "2 - 1"], [2, 2, "3 - 0"]]],
                                                          [["Select Teams:", "Use auto diff option to calculate diff using kills.", []]]));
          const collect = menu.createMessageComponentCollector({componentType: 3, time: 60000});
          // get teams and diff on button press, then continue
          var w, l, d;
          collect.on("collect", async e => {
            if(e.customId == "winning team") w = e.values[0];
            else if(e.customId == "losing team") l = e.values[0];
            await e.deferUpdate();
          });
          try {
            const next = await menu.awaitMessageComponent({filter: e => e.user.id == interaction.user.id && e.customId.length < 10, time: 60000});
            // ensure both teams were selected
            if(!w || !l){
              interaction.editReply(embed([], [["Two teams must be selected.", "", []]]));
              return;
            }
            // get diff
            d = next.customId;
          } catch {
            // timeout after 1 minute
            interaction.editReply(embed([], [["No selection was made within one minute.", "Please re-use the command if you still wish to submit.", []]]));
            return;
          }
          // get mons on each roster
          var p1 = data.slice(2).filter((_, i, a) => a[i + 1] == n[w]).map(e => [e, 0, 0, false]);
          var p2 = data.slice(2).filter((_, i, a) => a[i + 1] == n[l]).map(e => [e, 0, 0, false]);
        }
        // prompt user to input stats for each mon
        let i = 0;
        while(i < p1.length + p2.length){
          let kd = i < p1.length ? p1[i] : p2[i % p1.length];
          let head = n[i < p1.length ? w : l] + " - " + kd[0];
          let input = embed([[[2, 3, "+Kill"], [2, 2, "-Kill"], [2, 4, "+Death"], [2, 2, "-Death"]], [[2, 1, "Previous"], [2, 1, "Next"], [2, 2, "Skip"]]],
                            [[head, "If this mon was not brought, select Skip." + (i < p1.length + p2.length - 1 ? "" : "\n**This is the last mon. Proceeding will submit the match.**"), [["Kills:", kd[1], true],["Deaths:", kd[2], true]]]]);
          // prevent out of range
          if(i == 0) input.components[1].components[0].disabled = true;
          const res = await interaction.editReply(input);
          // handle button press
          try {
            const confirm = await res.awaitMessageComponent({filter: e => e.user.id == interaction.user.id, idle: 60000});
            if(confirm.customId == "next" || confirm.customId == "skip") {
              // change mon; set game played flag to true if Next was selected
              if(i < p1.length) p1[i][3] = confirm.customId == "next";
              else p2[i % p1.length][3] = confirm.customId == "next";
              i++;
            } else if(confirm.customId == "previous") i--;
            else {
              // update kills/deaths
              if(i < p1.length) p1[i][confirm.customId[1] == "k" ? 1 : 2] += confirm.customId[0] == "+" ? 1 : -1;
              else p2[i % p1.length][confirm.customId[1] == "k" ? 1 : 2] += confirm.customId[0] == "+" ? 1 : -1;
            }
            confirm.deferUpdate();
          } catch {
            // timeout after 1 minute
            interaction.editReply(embed([], [["No input received for one minute.", "Please re-use the command if you still wish to submit.", []]]));
            return;
          }
        }
        // calculate diff
        if(d == "auto diff") d = Math.abs(p1.reduce((a, b) => a + b[2], 0) - p2.reduce((a, b) => a + b[2], 0));
        else if(d == "2 - 0") d = 2;
        else if(d == "3 - 0") d = 3;
        else d = 1;
        // send results to doc
        p1 = [...p1, ...p2].filter(e => e[3]).map(e => e[1].toString() + e[2].toString() + e[0]);
        if(s[2].includes("countpassive true")) p1 = p1.map(e => e[0] + "0" + e.slice(1));
        toDoc(s[1], ["match", w, l, d, r, ...p1].join(","));
        interaction.editReply(embed([], [["The match has been submitted!", "Check the doc for updated stats.", []]]));
        return;
      } catch {
        interaction.editReply(embed([], [["Something went wrong.", "Make sure that you have linked a doc with submission capabilities using /doc, and that the match data is valid.", []]]));
        return;
      }

    } else if(commandName === "doc") {
      
      await interaction.deferReply();
      // get url, check if valid
      let url = interaction.options.getString("url");
      if(url) {
        url = url.match(/\/d\/(.*?)\//);
        if(!url) {
          interaction.editReply(embed([], [["This link is invalid.", "Please retry with a valid Google Sheets link.", []]]));
          return;
        }
        // check if doc has been shared
        try{
          var form = await getData(url[1], "Wiglett", [0, 1]);
          if(form[0][0] == "!") throw Error();
        } catch {
          interaction.editReply(embed([], [["Unable to access doc.", "Make sure that the doc is publicly viewable.", []]]));
          return;
        }
        if(form[0] == "setup") {
          interaction.editReply(embed([], [["The doc template has not been set up.", "Follow the instructions on the doc before using this command.", []]]));
          return;
        }
        try {
          // try to get url of linked form
          let id = await fetch(form[0]).then(e => e.text());
          form = form[0].match(/\/e\/(.*?)\//)[1];
          id = id.match(/,0,\[\[(.*?),null,null,/)[1];
          // add to db
          let storage = await db.search(interaction.guildId);
          if(storage) {
            let s = await getDiv(storage.content.split(","), interaction);
            if(!s) return;
            if(s[2].includes("countpassive true")) toDoc(form + "&" + id, "countpassive");
            db.edit([url[1], form + "&" + id, ...s.slice(2)], storage);
          } else db.add(interaction.guildId, [url[1], form + "&" + id, "species true&countpassive false", "℻Div 1"]);
          // success
          interaction.editReply(embed([], [["Your doc was successfully linked!", "Fill in any necessary information, and you will be able to start the draft or submit matches.", []]]));
          return;
        } catch {
          // if failed, doc is not compatible, so give option to continue to setup wizard
          const res = await interaction.editReply(embed([[[2, 3, "Continue"], [2, 4, "Cancel"]]],
                                                        [["Continue to doc setup wizard?", "This doc is not yet compatible. You may use the doc setup wizard to add the necessary tabs to your doc, or cancel to view templates for easily creating a doc. If you used a template and think this is a mistake, try re-using the command.", []]]));
          interaction.editReply = interaction.editReply;
          try {
            const confirm = await res.awaitMessageComponent({filter: e => e.user.id == interaction.user.id, time: 60000});
            if(confirm.customId == "continue") {
              // send sheet id to setup wizard form
              toDoc(process.env.WIZARD, url[1]);
              await confirm.update(embed([], [["Use the link to access the setup wizard within 10 minutes.", "Go [here](https://script.google.com/home/projects/1e4_1O_RVNR4FW4A93ctvcLYnj2ES63y7RpqSTZeBdeajpEq7K-I_X34N/edit), click Run (or ctrl-r) and accept permissions to update your doc, then re-use this command to link your doc.", []]]));
              return;
            }
          } catch {
            // timeout after 1 minute
            interaction.editReply(embed([], [["Confirmation was not received within one minute.", "Please re-use the command if you still wish to link a doc.", []]]));
            return;
          }
        }
      }
      // if no url provided or setup wizard was cancelled, give links to templates
      interaction.editReply(embed([], [["Wiglett Doc Template", "Use [this link](https://docs.google.com/spreadsheets/d/1PReeJO8HAvJJmpQN-ox0k76liRKfQvUaxpg_h8-YTyA/copy) to make a copy, follow the instructions, then re-use this command to link the doc.", []]]));
      return;

    } else if(commandName === "rule") {
      
      let rule = interaction.options.getInteger("type");
      if(rule == 7) {
        interaction.reply(ephbed([], [["Adding Rules", `Rules allow you to define the drafting options of coaches beyond just setting point values. This is what each rule does:
- **cap:** Requires a coach to draft between a minimum and a maximum number of a set group of mons. To set a cap, enter the following into the data parameter: **<tiers> <min> <max>**. For example, to only allow coaches to draft 2 mons from the Restricted tier (R), enter **R 0 2**. Or, if you want to make coaches draft exactly 3 mons that cost 10, 11, or 12 points, do **10,11,12 3 3**.
- **min length:** Specifies the minimum number of mons a coach can draft. If this option is not set, each coach will be required to fill their roster. To set min length, enter a number into the data parameter.
- **megas:** Specifies the maximum number of megas a coach can draft. To set megas, enter a number into the data parameter.
- **species:** Prevents a coach from drafting multiple mons with the same dex number. This is on by default, and you can use the command to toggle it.
- **count passives:** This is the only rule that is not related to the draft. If this is toggled on, using /submit will include passive kills in its submission. This will also update the doc to collect passive kills.`, []]]));
        return;
      }
      await interaction.deferReply();
      // get current rules
      let storage = await db.search(interaction.guildId);
      if(!storage) {
        interaction.editReply(embed([], [["Doc not found.", "Please use the /doc command before adding any rules.", []]]));
        return;
      }
      let s = await getDiv(storage.content.split(","), interaction);
      if(!s) return;
      if(!s[0]) {
        interaction.editReply(embed([], [["Doc not found.", "Please use the /doc command before adding any rules.", []]]));
        return;
      }
      let rules = s[2].split("&").map(e => e.replaceAll("/", ","));
      // handle rule changes
      let data = interaction.options.getString("data");
      if(!data && rule > 0 && rule < 5) {
        interaction.editReply(embed([], [["Incorrect rule format.", "This rule requires data (see /guide adding rules).", []]]));
        return;
      }
      if(rule == 2) {
        // cap
        let d = data.split(" ");
        if(d.length != 3 || isNaN(d[1]) || isNaN(d[2])) {
          interaction.editReply(embed([], [["Incorrect rule format.", "Format should be <tiers> <min> <max> (ie. 14,15,16 0 3).", []]]));
          return;
        }
        rules.push("cap " + data);
      } else if(rule > 0 && rule < 5) {
        // delete, minlength, megas
        if(isNaN(data)) {
          interaction.editReply(embed([], [["Incorrect rule format.", "Data should be an integer.", []]]));
          return;
        }
        if(rule == 1) {
          if(data <= 1) rule = 5;
          else if(data == 2) rule = 6;
          else rules.splice(parseInt(data) - 1, 1);
        } else {
          let m = rule < 4 ? "minlength " : "megas ";
          let i = rules.findIndex(e => e.includes(m));
          rules.splice(...(i == -1 ? [2, 0, m + data] : [i, 1, m + data]));
        }
      }
      if(rule == 5) {
        // species
        if(!data || (data != "true" && data != "false")) rules[0] = "species " + (rules[0].split(" ")[1] == "false"); 
        else rules[0] = "species " + data;
      } else if(rule == 6) {
        // countpassive
        let m = rules[1].split(" ")[1];
        if(!data || (data != "true" && data != "false")) data = rules[1].split(" ")[1] == "false";
        if(m != data) {
          rules[1] = "countpassive " + data;
          toDoc(s[1], "countpassive");
        }
      }
      if(rules.length > 10) {
        interaction.editReply(embed([], [["Too many rules.", "The current limit for rules is 10. Please delete a rule before adding a new one.", []]]));
        return;
      }
      // update and display rules
      let out = rules.map((e, i) => i + 1 + " - " + "/" + e).join("\n");
      if(rule == 6 && out.includes("countpassive true")) out = "**Note: countpassive is not compatible with manual submissions. If this is a WiFi league, this rule should be disabled.**\n" + out;
      if(rule > 0) db.edit([...s.slice(0, 2), rules.join("&").replaceAll(",", "/"), ...s.slice(3)], storage);
      interaction.editReply(embed([], [[rule > 1 ? "Rules changed successfully!" : "Current Rules:", out, []]]));
      return;

    } else if(commandName === "div") {
      
      await interaction.deferReply();
      // create storage if unavailable
      let action = interaction.options.getInteger("action");
      let storage = await db.search(interaction.guildId);
      if(!storage) {
        await db.add(interaction.guildId, ["", "", "species true&countpassive false", "℻Div 1"]);
        storage = await db.search(interaction.guildId);
      }
      // get divs
      let s = storage.content.split(",");
      let divs = s.filter(e => e[0] == "℻");
      if(action == 2) {
        if(divs.length < 2) {
          interaction.editReply(embed([], [["You cannot delete the only division.", "Please add another division before deleting one, or rename the current division.", []]]));
          return;
        }
      } else {
        // check name if applicable
        var name = interaction.options.getString("name");
        if(!name) {
          interaction.editReply(embed([], [["Name not specified.", "Please use the name parameter when creating or renaming a div.", []]]));
          return;
        }
        if(name.length > 100) {
          interaction.editReply(embed([], [["Name is too long.", "Please choose a name that is 100 characters or fewer.", []]]));
          return;
        }
        name = "℻" + name.replaceAll(",", "");
        if(divs.includes(name)) {
          interaction.editReply(embed([], [["Name is not unique.", "You cannot have multiple divisions with the same name.", []]]));
          return;
        }
      }
      // create div
      if(action == 0) {
        if(divs.length > 4) {
          interaction.editReply(embed([], [["You cannot have more than 5 divisions.", "Please delete a division before adding another, or rename a current division.", []]]));
          return;
        }
        s.push("", "", s[2], name);
      } else {
        // prompt for existing div
        let div = await getDiv(s, interaction);
        if(!div) return;
        // rename div
        if(action == 1) s[s.indexOf(div.at(-1))] = name;
        // delete div
        else s.splice(s.indexOf(div.at(-1)) - div.length + 1, div.length);
      }
      // update and display divs
      store(s.join(","), storage);
      await interaction.editReply(embed([], [["Div successfully " + ["created.","renamed.","deleted."][action], "Current divs:\n" + s.filter(e => e[0] == "℻").map(e => e.slice(1)).join("\n"), []]]));
      return;

    } else if(commandName === "guide") {

      interaction.reply(ephbed([], [["Quickstart", `This is a guide to setting up Wiglett for a draft league. Doing so requires Manage Server permissions (so randoms can't mess with your settings). If *you* are said random without these permissions, **/draft**, **/leavepick**, and **/analyze** are the commands you are looking for.
1. If you need multiple divisions, use **/div** to create them.
2. Use **/doc** to link a doc.
  - If you already have a doc, paste the URL into the /doc command and follow the instructions.
  - If you do not have a doc, use the command without pasting anything to get the link to the doc template. Make a copy, then follow the instructions.
3. Add your coaches to the doc, and update the tierlist.
4. Use **/rule** to specify any rules for the draft if needed. See /rule help for more info.
5. Use **/draftmod** start to start the draft. The other /draftmod options (ie. timer) can be used to moderate the draft.
  - During the draft, coaches can use **/draft** to draft a mon.
  - They can (and should) also use **/leavepick** to leave picks. These picks will automatically be drafted when it is their turn, greatly speeding up the draft.
  - If you need to change a pick during the draft, edit the (potentially hidden) WiglettData tab on the doc.
6. After the draft is over, use **/submit** to submit matches to the doc. There is a replay option for showdown leagues, and a manual option for WiFi leagues.`, []]]));
      return;

    }
  } catch(err) {
    console.log(err);
    interaction.editReply("An unexpected error has been encountered. It has been reported to my creator, who will hopefully fix it soon.");
    toDoc(process.env.ERROR, "Server ID: " + interaction.guildId + "\nError: " + err);
  }
});

client.on("guildDelete", guild => db.delete(guild.id));

// Login to Discord with token
client.login(process.env.TOKEN);
