let socket = 0
let Player   = ""
let IntervalTimer
let TimeoutTimer
let chartNumbers = []
let chartLabels = []
let RoundTimer = 10
window.addEventListener('load', function () {
  
  try {
    console.log("Connect to the server...")
    socket = new WebSocket('ws://localhost:8080');
  } catch (error) {
    console.log("error to connect",error)
    return
  }
  
  socket.onopen = function () {
    ShowLogin()
    console.log("server connected")
  };

  socket.onmessage = function (message) {
      console.log(message.data)
      try {
        checkEvent(socket,JSON.parse(message.data))
      } catch (error) {
        console.error(error)
      }
      
      
  };

  socket.onerror = function (error) {
    HideElement("PlayBord")
    alert("Error connect to the server")
    console.log('WebSocket error: ' + error);
  };
  })

  function checkEvent(socket,msg) {
  
    switch (msg.event) {
        case "UserRounds":
            _UserRounds(msg)
            break;
        case "RoundResult":
            _ShowResult(msg)
            break;
        case "SetConfig":
            _SetConfig(msg.data)
            break;
        case "ResetGame":
            _ResetGame(msg.data)
            break;
    
        default:
            break;
    }
  }
  


// Start new round
function StartPlay() {
        if(AskGuessNumber()){
          HideElement("PanelResult")
          HideElement("PanelStartPlay")
        }
  }
  
  // login
  function Login() {
      let elemName = document.getElementById("PlayerName")
      if(elemName.value == "") return alert("Pleas Enter Your Name")
      socket.emit("Login",elemName.value)
      HideElement("loginPlay")
      HideElement("PanelResult")
      ShowWaitAnimation()
    
  }

  function Loninkeypress(event) {
    if (event.key === "Enter") {
      Login()
    }
  }

  // reset the game
  function _ResetGame() {

  if (confirm("Are you sure to reset the game") == true) {
        clearInterval(IntervalTimer);
        clearInterval(TimeoutTimer);
        HideElement("PlayBord")
        HideElement("PanelResult")
        chartNumbers = []
        chartLabels = []
        updateChart()
        for (let index = 1; index < 6; index++) {
          SetPlayerDead(index)
          HideElement(`crown${index}`)
        }
        ShowPanelStartPlay()
        ShowWaitAnimation()
        socket.emit("ResetGame",Player)
  }
    
  }

  function AskGuessNumber() {
    let number = prompt("Please enter your guess number", "");
  
    if (number <= 9.99 && number >= 0.01) {
      socket.emit("Guesse",{number : number,Player : Player})
      return true
    }else{
      alert("Error, Please Enter Number Betwin 0.01 and 9.99")
    }
  
    
  }

 function _ShowResult(data) {
 
  let NextSec = document.getElementById("NextSec")
  NextSec.innerHTML = RoundTimer
  
  document.getElementById("SecretNumberID").innerHTML = data.SecretNumber
  
  DrawRoundChart(data.SecretNumber)
  ShowRoundResult(data.Result)

 
  ShowTextRound()
  ShowPanelResult()
    
    GetBestPlayer(data.Result)

    if(data.Result[0].Credit < 10){
      alert("This Game is over, you lost")
      HideElement("PanelStartPlay")
      return
    }
    
    if(data.GameOver){
      alert("The Game is over, You are the winner")
      HideElement("TextRound") 
    } else {
      IntervalTimer = setInterval(()=>{
        NextSec.innerHTML = (Number(NextSec.innerHTML) - 1)
      },1000)
      
      TimeoutTimer = setTimeout(()=> {
        HideElement("TextRound") 
        clearInterval(IntervalTimer)
        ShowPanelStartPlay()
      } ,RoundTimer * 1000)
    }
    
  
  }
  function _SetConfig(config) {
    RoundTimer = config.RoundTimer
  }
  function _UserRounds(data) {
      if(data.status){
        DrawOnChart(data.data)
        Player = data.user
        document.getElementById("realPlayer").innerHTML = data.user.User      // set real player Name on the card
        document.getElementById("Player1Credit").innerHTML = data.user.Credit // set real player Credit on the card
        
        // Check Real Player is lost on not
        if(data.user.Credit < 10){
          checkPlayerIsDead(data.user.Credit,1)
          alert("This Game is over, you lost")
          HideElement("PanelStartPlay")
        }

        // set comuter players Credit on the card
        for (let index = 0; index < 4; index++) {
          upadtePlayerCredit(data.user.PlayerCredit[index],index+2)
        }
        
        ShowPlayBord() // show Play button
          }
  }



// Get the best Player and give him crown
function GetBestPlayer(ListPlayer) {
  let indexPlayer = 0
  let bestScore   = 0
  ListPlayer.forEach((Player,index) => {
      HideElement(`crown${index+1}`)
      if(Player.Credit > bestScore){
        bestScore = Player.Credit
        indexPlayer = index+1
      }
  })
  if(indexPlayer != 0) document.getElementById(`crown${indexPlayer}`).style.display = "block"
}

function ShowRoundResult(Result) {
  let ResultTableBody = document.getElementById("ResultTableBody")
  ResultTableBody.innerHTML = "" 
  Result.forEach((Player, index) => {
    upadtePlayerCredit(Player.Credit,index+1)
    ResultTableBody.innerHTML += `<tr>
                                  <td>${Player.Won > 0 ? "Won" : "Lost"}</td>
                                  <td>${Player.Name}</td>
                                  <td>${Player.gNum}</td>
                                  <td>${Player.Won}</td>
                                  <td>${Player.Credit}</td>
                                </tr>`
  });
}


// Draw Chart
function DrawOnChart(Rounds) {
  Rounds.forEach((round,index) => {
    chartNumbers.push(round.SecretNumber)
    chartLabels.push("Round "+index)
  })
  updateChart()
}

function DrawRoundChart(SecretNumber) {
  chartNumbers.push(SecretNumber)
  chartLabels.push("Round "+chartLabels.length)
  updateChart()
}

function updateChart() {
  let chart = document.querySelector('canvas').chart;
  chart.data.datasets[0].data = chartNumbers
  chart.data.labels = chartLabels
  chart.update();
}


// Helper Functions

function checkPlayerIsDead(Credit,index) {
  if(Credit < 10) SetPlayerDead(index)
}

function SetPlayerDead(index,Dead = true) {
document.getElementById(`Player-${index}`).setAttribute("data-isdead",Dead)
}

function upadtePlayerCredit(Credit,index) {
  checkPlayerIsDead(Credit,index)
  document.getElementById(`Player${index}Credit`).innerHTML = Credit
}

function ShowPanelStartPlay() {
  document.getElementById("PanelStartPlay").style.display = "block"
}

function ShowPanelResult() {
  document.getElementById("PanelResult").style.display = "block"
}
function ShowTextRound() {
  document.getElementById("TextRound").style.display = "block"
}

  function ShowLogin() {
    HideElement("WaitAnim") 
    document.getElementById("loginPlay").style.display = "flex"
  }
  function ShowWaitAnimation() {
    document.getElementById("WaitAnim").style.display = "flex"
  }
  
  function HideLogin() {
    document.getElementById("loginPlay").style.display = "flex"
  }
  
  function ShowPlayBord() {
    HideElement("WaitAnim") 
    document.getElementById("PlayBord").style.display = "block"
  }
  function HideElement(ElementID) {
    document.getElementById(ElementID).style.display = "none"
  }

  WebSocket.prototype.emit = function(event,data) {
  this.send(JSON.stringify({event : event,data : data}));
 }