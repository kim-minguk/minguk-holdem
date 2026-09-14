
const express=require("express"), http=require("http"), path=require("path"), crypto=require("crypto");
const {Server}=require("socket.io");
const app=express(), server=http.createServer(app), io=new Server(server,{pingTimeout:20000,pingInterval:10000});
app.use(express.static(path.join(__dirname,"public")));
const PORT=process.env.PORT||3000, rooms=new Map();
const code=()=>Math.random().toString(36).slice(2,7).toUpperCase();
const token=()=>crypto.randomBytes(12).toString("hex");
const mkDeck=()=>{let d=[],S=["♠","♥","♦","♣"],R=["2","3","4","5","6","7","8","9","10","J","Q","K","A"];for(const s of S)for(const r of R)d.push({s,r});for(let i=d.length-1;i;i--){let j=Math.floor(Math.random()*(i+1));[d[i],d[j]]=[d[j],d[i]]}return d};
const rv=r=>({2:2,3:3,4:4,5:5,6:6,7:7,8:8,9:9,10:10,J:11,Q:12,K:13,A:14})[r];
function combos(a,k){let o=[];function f(s,p){if(p.length===k){o.push([...p]);return}for(let i=s;i<a.length;i++){p.push(a[i]);f(i+1,p);p.pop()}}f(0,[]);return o}
function e5(c){let v=c.map(x=>rv(x.r)).sort((a,b)=>b-a),ct={};v.forEach(x=>ct[x]=(ct[x]||0)+1);let u=[...new Set(v)].sort((a,b)=>b-a);if(u[0]===14)u.push(1);let sh=0;for(let i=0;i<=u.length-5;i++)if(u[i]-u[i+4]===4){sh=u[i];break}let fl=c.every(x=>x.s===c[0].s),g=Object.entries(ct).map(([v,c])=>({v:+v,c})).sort((a,b)=>b.c-a.c||b.v-a.v),cat,n,t;
if(fl&&sh){cat=8;n=sh===14?"로열/스트레이트 플러시":"스트레이트 플러시";t=[sh]}else if(g[0].c===4){cat=7;n="포카드";t=[g[0].v,g[1].v]}else if(g[0].c===3&&g[1].c===2){cat=6;n="풀하우스";t=[g[0].v,g[1].v]}else if(fl){cat=5;n="플러시";t=v}else if(sh){cat=4;n="스트레이트";t=[sh]}else if(g[0].c===3){cat=3;n="트리플";t=[g[0].v,...g.filter(x=>x.c===1).map(x=>x.v).sort((a,b)=>b-a)]}else if(g[0].c===2&&g[1].c===2){cat=2;n="투페어";let p=[g[0].v,g[1].v].sort((a,b)=>b-a);t=[...p,g.find(x=>x.c===1).v]}else if(g[0].c===2){cat=1;n="원페어";t=[g[0].v,...g.filter(x=>x.c===1).map(x=>x.v).sort((a,b)=>b-a)]}else{cat=0;n="하이카드";t=v}let sc=cat*1e10;t.forEach((x,i)=>sc+=x*Math.pow(15,5-i));return{score:sc,name:n}}
function e7(c){let b={score:-1,name:""};for(const x of combos(c,5)){let e=e5(x);if(e.score>b.score)b=e}return b}
const next=(r,i,pred)=>{for(let k=1;k<=r.players.length;k++){let j=(i+k)%r.players.length;if(pred(r.players[j]))return j}return-1};
const live=r=>r.players.filter(p=>p.inHand&&!p.folded), actors=r=>r.players.filter(p=>p.inHand&&!p.folded&&!p.allin);
function broadcast(r,event,data){
  for(const p of r.players){
    const sock=io.sockets.sockets.get(p.socketId);
    if(sock&&p.connected)sock.emit(event,data);
  }
}
function announce(r,text){
  broadcast(r,"announce",{text:String(text||"").slice(0,160),ts:Date.now()});
}
function addChat(r,name,text,system=false){
  const msg={name:String(name||"").slice(0,12),text:String(text||"").trim().slice(0,160),ts:Date.now(),system};
  if(!msg.text)return;
  r.chat=r.chat||[];
  r.chat.push(msg);
  if(r.chat.length>60)r.chat.shift();
  broadcast(r,"chat",msg);
}
function emit(r){for(const p of r.players){let s=io.sockets.sockets.get(p.socketId);if(!s)continue;s.emit("state",{code:r.code,host:r.hostToken===p.token,phase:r.phase,street:r.street,board:r.board,pot:r.pot+r.players.reduce((a,x)=>a+x.bet,0),dealer:r.dealer,turn:r.turn,currentBet:r.currentBet,minRaise:r.minRaise,msg:r.msg,handNo:r.handNo,settings:r.settings,turnDeadline:r.turnDeadline||0,countdownValue:r.countdownValue??null,connectedCount:r.players.filter(x=>x.connected).length,chat:r.chat||[],me:p.token,players:r.players.map(x=>({token:x.token,name:x.name,chips:x.chips,bet:x.bet,total:x.total,folded:x.folded,allin:x.allin,inHand:x.inHand,connected:x.connected,lastAction:x.lastAction||"",cards:x.token===p.token?x.cards:(r.phase==="showdown"&&x.inHand&&!x.folded?x.cards:[])}))})}}
function collect(r){r.players.forEach(p=>{r.pot+=p.bet;p.bet=0});r.currentBet=0;r.minRaise=r.settings.bb;r.acted=new Set}
function post(r,i,a){let p=r.players[i],v=Math.min(a,p.chips);p.chips-=v;p.bet+=v;p.total+=v;if(!p.chips)p.allin=true}
function start(r){let eligible=r.players.filter(p=>p.connected&&p.chips>0);if(eligible.length<2){r.phase="lobby";r.msg="2명 이상 필요합니다.";emit(r);return}r.handNo++;r.deck=mkDeck();r.board=[];r.pot=0;r.street="preflop";r.currentBet=0;r.minRaise=r.settings.bb;r.acted=new Set;r.msg="";
r.players.forEach(p=>{p.inHand=p.connected&&p.chips>0;p.folded=false;p.allin=false;p.bet=0;p.total=0;p.cards=[];p.lastAction=""});r.dealer=next(r,r.dealer<0?r.players.length-1:r.dealer,p=>p.inHand);for(let z=0;z<2;z++)for(let k=1;k<=r.players.length;k++){let i=(r.dealer+k)%r.players.length;if(r.players[i].inHand)r.players[i].cards.push(r.deck.pop())}
let sb=next(r,r.dealer,p=>p.inHand),bb=next(r,sb,p=>p.inHand);post(r,sb,r.settings.sb);post(r,bb,r.settings.bb);r.currentBet=Math.max(r.players[sb].bet,r.players[bb].bet);r.turn=next(r,bb,p=>p.inHand&&!p.allin);r.phase="playing";emit(r);auto(r);beginTurnTimer(r)}
const roundDone=r=>{let a=actors(r);return !a.length||a.every(p=>p.bet===r.currentBet&&r.acted.has(p.token))};
function awardOne(r){clearTurnTimer(r);collect(r);let w=live(r)[0];if(w){w.chips+=r.pot;r.msg=`${w.name} 승리 +${r.pot.toLocaleString()} 칩`;announce(r,`${w.name}님 승리`)}r.pot=0;r.phase="showdown";r.turn=-1;emit(r)}
function showdown(r){clearTurnTimer(r);collect(r);let active=r.players.filter(p=>p.inHand), levels=[...new Set(active.map(p=>p.total).filter(x=>x>0))].sort((a,b)=>a-b),prev=0,desc=[];
for(const level of levels){let participants=active.filter(p=>p.total>=level),amount=(level-prev)*participants.length,cont=participants.filter(p=>!p.folded);if(amount>0&&cont.length){let ev=cont.map(p=>({p,e:e7([...p.cards,...r.board])})),mx=Math.max(...ev.map(x=>x.e.score)),ws=ev.filter(x=>x.e.score===mx),share=Math.floor(amount/ws.length),rem=amount-share*ws.length;ws.forEach((x,i)=>x.p.chips+=share+(i===0?rem:0));desc.push(`${ws.map(x=>x.p.name+"("+x.e.name+")").join(", ")} +${amount.toLocaleString()}`)}prev=level}
r.msg=desc.join(" / ");announce(r,"쇼다운. "+r.msg);r.pot=0;r.phase="showdown";r.turn=-1;emit(r)}
function advance(r){if(live(r).length<=1)return awardOne(r);collect(r);if(r.street==="preflop"){r.street="flop";r.board.push(r.deck.pop(),r.deck.pop(),r.deck.pop());announce(r,"플랍 오픈")}else if(r.street==="flop"){r.street="turn";r.board.push(r.deck.pop());announce(r,"턴 오픈")}else if(r.street==="turn"){r.street="river";r.board.push(r.deck.pop());announce(r,"리버 오픈")}else return showdown(r);r.turn=next(r,r.dealer,p=>p.inHand&&!p.folded&&!p.allin);emit(r);auto(r);beginTurnTimer(r)}
function auto(r){if(r.phase==="playing"&&!actors(r).length)setTimeout(()=>advance(r),400)}
function action(r,t,type,amount){
  if(r.phase!=="playing"||r.turn<0)return;
  let p=r.players[r.turn]; if(!p||p.token!==t)return;
  clearTurnTimer(r);
  let call=Math.max(0,r.currentBet-p.bet);

  if(type==="fold"){
    p.folded=true; r.acted.add(t); p.lastAction="다이";
    addChat(r,"SYSTEM",`${p.name} · 다이`,true);
    announce(r,"다이");
  } else if(type==="call"){
    let v=Math.min(call,p.chips);
    p.chips-=v; p.bet+=v; p.total+=v;
    if(!p.chips)p.allin=true;
    r.acted.add(t);
    if(call===0){
      p.lastAction="체크";
      addChat(r,"SYSTEM",`${p.name} · 체크`,true);
      announce(r,"체크");
    }else{
      p.lastAction=`콜 ${v.toLocaleString()}`;
      addChat(r,"SYSTEM",`${p.name} · 콜 ${v.toLocaleString()}`,true);
      announce(r,`콜 ${v.toLocaleString()}원`);
    }
  } else if(type==="raise"){
    let target=Math.min(Math.floor(+amount||0),p.bet+p.chips),min=r.currentBet+r.minRaise;
    if(target<=r.currentBet)return action(r,t,"call");
    if(target<min&&target<p.bet+p.chips)return;
    let add=target-p.bet;
    p.chips-=add; p.bet=target; p.total+=add;
    if(!p.chips)p.allin=true;
    r.minRaise=Math.max(r.settings.bb,target-r.currentBet);
    r.currentBet=target; r.acted=new Set([t]);
    p.lastAction=`레이즈 ${target.toLocaleString()}`;
    addChat(r,"SYSTEM",`${p.name} · 레이즈 ${target.toLocaleString()}`,true);
    announce(r,`레이즈 ${target.toLocaleString()}원`);
  } else if(type==="allin"){
    let target=p.bet+p.chips,add=p.chips;
    p.chips=0; p.bet=target; p.total+=add; p.allin=true;
    if(target>r.currentBet){
      r.minRaise=Math.max(r.settings.bb,target-r.currentBet);
      r.currentBet=target; r.acted=new Set([t]);
    }else r.acted.add(t);
    p.lastAction=`올인 ${target.toLocaleString()}`;
    addChat(r,"SYSTEM",`${p.name} · 올인 ${target.toLocaleString()}`,true);
    announce(r,`올인 ${target.toLocaleString()}원`);
  }

  if(live(r).length<=1)return awardOne(r);
  if(roundDone(r))return advance(r);
  r.turn=next(r,r.turn,x=>x.inHand&&!x.folded&&!x.allin);
  emit(r); auto(r); beginTurnTimer(r);
}
function clearTurnTimer(r){
  if(r.turnTimer){clearTimeout(r.turnTimer);r.turnTimer=null;}
  if(r.countdownTimer){clearInterval(r.countdownTimer);r.countdownTimer=null;}
  r.turnDeadline=0;r.countdownValue=null;
}
function beginTurnTimer(r){
  clearTurnTimer(r);
  if(r.phase!=="playing"||r.turn<0)return;
  const p=r.players[r.turn]; if(!p||!p.inHand||p.folded||p.allin)return;
  r.turnDeadline=Date.now()+15000;
  r.countdownValue=null;
  emit(r);
  r.turnTimer=setTimeout(()=>{
    if(r.phase!=="playing"||r.turn<0)return;
    const current=r.players[r.turn];
    if(!current||current.token!==p.token)return;
    r.countdownValue=5;
    emit(r);
    r.countdownTimer=setInterval(()=>{
      if(r.phase!=="playing"||r.turn<0){clearTurnTimer(r);return;}
      const nowp=r.players[r.turn];
      if(!nowp||nowp.token!==p.token){clearTurnTimer(r);return;}
      r.countdownValue--;
      if(r.countdownValue<=0){
        clearTurnTimer(r);
        addChat(r,"SYSTEM",`${p.name} · 시간초과 다이`,true);
        announce(r,"시간 초과. 다이");
        p.lastAction="시간초과 다이";
        p.folded=true;r.acted.add(p.token);
        if(live(r).length<=1)return awardOne(r);
        if(roundDone(r))return advance(r);
        r.turn=next(r,r.turn,x=>x.inHand&&!x.folded&&!x.allin);
        emit(r);auto(r);beginTurnTimer(r);
      }else emit(r);
    },1000);
  },10000);
}

io.on("connection",s=>{s.on("create",d=>{let c=code();while(rooms.has(c))c=code();let pt=token(),settings={start:Math.max(1000,Math.min(100000,+d.start||10000)),sb:Math.max(10,+d.sb||50),bb:Math.max(20,+d.bb||100),max:Math.max(2,Math.min(6,+d.max||6))};if(settings.bb<settings.sb*2)settings.bb=settings.sb*2;let r={code:c,password:String(d.password||""),hostToken:pt,players:[],phase:"lobby",street:"",board:[],pot:0,dealer:-1,turn:-1,currentBet:0,minRaise:settings.bb,acted:new Set,msg:"",handNo:0,settings,chat:[],turnTimer:null,countdownTimer:null,turnDeadline:0,countdownValue:null};let cname=String(d.name||"").trim().slice(0,12);if(!cname)return s.emit("err","닉네임을 입력해주세요.");r.players.push({token:pt,socketId:s.id,name:cname,chips:settings.start,bet:0,total:0,cards:[],folded:false,allin:false,inHand:false,connected:true,lastAction:""});rooms.set(c,r);s.data={room:c,token:pt};s.join(c);addChat(r,"SYSTEM",`${r.players[0].name}님이 방을 만들었습니다.`,true);emit(r)});
s.on("join",d=>{let r=rooms.get(String(d.code||"").toUpperCase());if(!r)return s.emit("err","방을 찾을 수 없습니다.");if(r.password&&r.password!==String(d.password||""))return s.emit("err","비밀번호가 다릅니다.");if(r.players.filter(p=>p.connected).length>=r.settings.max)return s.emit("err","방이 가득 찼습니다.");if(r.phase==="playing")return s.emit("err","현재 핸드 진행 중입니다. 핸드 종료 후 입장해주세요.");let jname=String(d.name||"").trim().slice(0,12);if(!jname)return s.emit("err","닉네임을 입력해주세요.");let pt=token();r.players.push({token:pt,socketId:s.id,name:jname,chips:r.settings.start,bet:0,total:0,cards:[],folded:false,allin:false,inHand:false,connected:true,lastAction:""});s.data={room:r.code,token:pt};s.join(r.code);addChat(r,"SYSTEM",`${r.players[r.players.length-1].name}님이 입장했습니다.`,true);announce(r,`${r.players[r.players.length-1].name}님이 입장했습니다.`);emit(r)});
s.on("start",()=>{let r=rooms.get(s.data?.room);if(r&&r.hostToken===s.data.token&&r.phase!=="playing")start(r)});
s.on("act",d=>{let r=rooms.get(s.data?.room);if(r)action(r,s.data.token,d.type,d.amount)});
s.on("chat",d=>{
  const r=rooms.get(s.data?.room); if(!r)return;
  const p=r.players.find(x=>x.token===s.data.token&&x.connected); if(!p)return;
  addChat(r,p.name,d?.text||"",false);
});
s.on("disconnect",()=>{let r=rooms.get(s.data?.room);if(!r)return;let p=r.players.find(x=>x.token===s.data.token);if(p){p.connected=false;if(p.inHand&&!p.folded){p.folded=true;r.acted.add(p.token)}addChat(r,"SYSTEM",`${p.name}님이 퇴장했습니다.`,true)}if(r.hostToken===s.data.token){let n=r.players.find(x=>x.connected);if(n)r.hostToken=n.token}if(!r.players.some(x=>x.connected)){clearTurnTimer(r);return rooms.delete(r.code);}if(r.phase==="playing"&&live(r).length<=1)awardOne(r);else emit(r)})});
server.listen(PORT,()=>console.log("민국 홀덤:",PORT));
