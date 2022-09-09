// server.js
const Mongoose  = require('mongoose');
const WebSocket = require('ws')

const dbName = "GuessGame"                               // DataBase Name
const dbUrl  = "mongodb://localhost:27017/"+dbName;

let OnlineUser = []  // List of online users

let RoundTimer = 2  // Waiting time between each round

const {Users , History} =  initDataBase(dbUrl)

StratWsServer()


// Front end Event
function checkEvent(socket,msg) {
    switch (msg.event) {
        case "Login":
            _Login(socket,msg.data)
            break;
        case "ResetGame":
            _ResetGame(socket,msg.data)
            break;
        case "Guesse":
            _Guesse(socket,msg.data)
        default:
            break;
    }
}



// WebSocket Server
function StratWsServer() {
    const wss = new WebSocket.Server({ port: 8080 })
    console.log(`Server Started on port`,wss.options.port)
    wss.on('connection', ws => {

            ws.on('message', message => {
                try {
                    checkEvent(ws,JSON.parse(message))
                } catch (error) {
                    
                }
            })

            ws.send(JSON.stringify(
                {
                    event:"SetConfig",
                    data : {RoundTimer : RoundTimer}
                }
                ))
            ws.on("close",event =>{
                console.log("onClose",event)
            })

    })
}




// User Login Load old round or create new user
function _Login(socket,UserName) {

    // Check out the cheating attempt
    // Check the waiting time for the next round
    if(CheckUserIsDisable(UserName)) return


    try {
        // Search user in database
        GetUser({User : UserName}).then((gUser) => {

        if(gUser.User.length > 0){
            History.find({UserID: gUser.User[0]._id}).then(Rounds => {

                // If the user has not played any round but his account exists
                if(Rounds.length == 0) Rounds = [{SecretNumber:0,GuessedNumbers:[0,0,0,0,0]}] // Creates empty information

                // send data to the front end
                socket.send(JSON.stringify({event:"UserRounds",
                                            status : true,
                                            data : Rounds, // Round List
                                            user : gUser.User[0] // user informtion from Database
                                        }))

            })
        }else{
            // create new user if not exist
                const newPlayer = {User : UserName,Credit: 100,PlayerCredit : [100,100,100,100]} // default data

                // Insert a new user with default information
                Users.collection.insertOne(newPlayer, function (err, doc) {
                    if(err) throw err;
                    const Rounds = [{SecretNumber:0,GuessedNumbers:[0,0,0,0,0]}] // Empty Round

                    // send data to the front end with default data
                    socket.send(JSON.stringify({event:"UserRounds",
                                                status : true,
                                                data : Rounds, 
                                                user : {_id : doc.insertedId,  
                                                        User : UserName,
                                                        Credit : 100,
                                                        PlayerCredit : newPlayer.PlayerCredit
                                                    }
                                          }))
                })
            }

            // Add user to Online user list if not exist
            AddUserInOnlineListIfNotExist(UserName) 
        })
        
    } catch (error) {
        console.log(error)
        socket.send(JSON.stringify({event:"Error",status : false,data : "Error on the server"}))
    }
    
    
}


// Reset user information and delete all his rounds
function _ResetGame(socket,data) {

    // Delete user rounds
    History.deleteMany({ UserID : data._id }).then(function(){
        console.log("Data deleted");
    }).catch(function(error){
        console.log(error); 
    });

    // reset players Credit
    UpdateUser(data.User,{Credit: 100,PlayerCredit : [100,100,100,100]})

    // Enable play , Bypass next round time
    SetUserEnablePlay(data.User)

    // send user informtion
    _Login(socket,data.User)
}


// game mind
function _Guesse(socket,data) {

    const RealPlayer = data.Player.User

     // Check out the cheating attempt
    // Check the waiting time for the next round
    if(CheckUserIsDisable(RealPlayer)) return
 

    // generate the secret number
    let SecretNumber = SecretNumberGenerter()

    // Preparing the game list with default results
    let PlayerGuesse  = [
                            {
                                Name : RealPlayer,  // Player name                        // player 1 , Real Player
                                gNum : data.number, // Real palyer Guesse Number
                                Dead : false,       // if player Dead or no
                                Credit : 0,         // player Credit
                                Won : 0},           // Player earnings during the round
                            {Name : "Player 2",gNum : 0,Dead : false,Credit : 0,Won : 0}, // player 2 , computer-managed
                            {Name : "Player 3",gNum : 0,Dead : false,Credit : 0,Won : 0}, // player 2 , computer-managed
                            {Name : "Player 4",gNum : 0,Dead : false,Credit : 0,Won : 0}, // player 2 , computer-managed
                            {Name : "Player 5",gNum : 0,Dead : false,Credit : 0,Won : 0}  // player 2 , computer-managed
                        ]

    // Get user old informtion                    
    GetUser({User : RealPlayer}).then(result => {

        // Deduction of playing credit from real play
        PlayerGuesse[0].Credit = ( result.User[0].Credit - 10 )


        // Deduction of playing credit from computer players and generate Guesse number
        for (let index = 0; index < 4; index++) {
            const PlayerCreadit = result.User[0].PlayerCredit[index]
            if(PlayerCreadit < 10)
            {
                PlayerGuesse[index+1].Dead = true
            }else{
                // Deduction credit balance
                PlayerGuesse[index+1].Credit = PlayerCreadit - 10

                // set Guesse number
                PlayerGuesse[index+1].gNum   = ComputerGuesse()
            }
            
        }
        
        // save player Credit to database
        UpdateUser(RealPlayer,{Credit: PlayerGuesse[0].Credit,
                                        PlayerCredit : [
                                            PlayerGuesse[1].Credit,
                                            PlayerGuesse[2].Credit,
                                            PlayerGuesse[3].Credit,
                                            PlayerGuesse[4].Credit
                                            ]
                                    })

        // save Round history
        insertRound({UserID : data.Player._id,SecretNumber : SecretNumber,GuessedNumbers : PlayerGuesse})

         // Check winners and add their credits
        let Result = PlayerGuesse.map(Playear => {

                        if(Playear.gNum <= SecretNumber && Playear.Dead != true) { // Check if he won or not as well as if he died before
                            Playear.Dead = (Playear.Credit < 10) // Check if he died during this tour and record it
                            Playear.Won = Round(Playear.gNum * 10) // Double the profit
                            Playear.Credit += Playear.Won // Add to the old balance
                        }
                        // convert exmple 1.99999999999 to 1.99
                        Playear.Credit = Round(Playear.Credit)

                        return Playear
                    })

        // From the user from the game until the waiting time ends
        SetUserDisablePlay(RealPlayer)

        // save player Credit to database
        UpdateUser(RealPlayer,{Credit: Result[0].Credit,
                                      PlayerCredit : [
                                                    Result[1].Credit,
                                                    Result[2].Credit,
                                                    Result[3].Credit,
                                                    Result[4].Credit
                                                    ]
                                        })
            
        const isGameover = AreRealPlayerWiner(Result) // Check if the real saliva is the winner
        const isRealPlayerDead = Result[0].Dead       // Check if the real game is dead or not

        // send result to the server
        socket.send(JSON.stringify({event : "RoundResult",GameOver : isGameover,isRealPlayerDead : isRealPlayerDead,SecretNumber : SecretNumber,Result : Result}))
        
        
        setTimeout(()=>{
            SetUserEnablePlay(RealPlayer)
        },RoundTimer * 1000)
    })
    
}


function AreRealPlayerWiner(Result) {
    alives = Result.filter(player => {
        return player.Dead != true
    })

    if(alives.length == 1) return true
    return false
}




// Generate random numbers

function ComputerGuesse() {

    let myGuesse = Math.floor(Math.random() * 11)
    let ListGuesse = []

    // Create 5 predictions and then choose one of them
    for (let Guess = 0; Guess < 5; Guess++) {
        ListGuesse.push(SecretNumberGenerter())
    }

    // Choose one of the options
    let finalDecision = parseInt(Math.random() * 5)
    return ListGuesse[finalDecision]
}


function SecretNumberGenerter() {
    return Round(Math.floor(Math.random() * 1000)*0.01)
}


// DataBase

function initDataBase(dUrl) {
    
    /* Start to Connect database */
    Mongoose.connect(dUrl)
    .then(()=> console.log('Connected to MongoDB...'))
    .catch(err => console.error('could not connect to MongoDB!!!',err))

    const mySchemas = CreateSchema()

    return mySchemas
}
function CreateSchema() {
    const UsersSchema = new Mongoose.Schema({
        _id                 : String, 
        User                : String,
        Credit              : Number,
        Time                : {type : Date ,default : Date.now},
        PlayerCredit        : [Number],
    })

    const RoundsHistorySchema = new Mongoose.Schema({
        UserID              : String,
        SecretNumber         : Number,
        GuessedNumbers      : [Number],
        
    })

    const Users = Mongoose.model('Users',UsersSchema)
    const History = Mongoose.model('RoundsHistory',RoundsHistorySchema)
    return {Users : Users,History :  History}
}

function insertRound(jData){
    return History.collection.insertOne(jData, (err, docs) => {
        if (err){ 
            console.error(err);
            return false
        } else {
           return true
        }
      })
    
    
}

function UpdateUser(UserName,NewData) {
    Users.updateOne({User:UserName}, NewData, (err, docs) => {
        if (err){
            console.log(err)
            return false
        }
        else{
            return true
        }
    });
}

async function GetUser(userName){
    const User = await Users.find(userName)
    return {User,userName : userName.User}
}




// #region Users Online
            function CheckUserIsInOnlineList(name) {
                return OnlineUser.some(UserInfo => {
                    return (UserInfo.name == name)
                })
            }

            function AddUserInOnlineListIfNotExist(name) {
                if(CheckUserIsInOnlineList(name)) return
                OnlineUser.push({name : name,Wait : false})
            }

            function SetUserEnablePlay(name) {
                OnlineUser.map(UserInfo => {
                    if(UserInfo.name == name ) UserInfo.Wait = false
                    return UserInfo
                })
            }
            function SetUserDisablePlay(name) {
                OnlineUser.map(UserInfo => {
                    if(UserInfo.name == name ) UserInfo.Wait = true
                    return UserInfo
                })
            }

            function CheckUserIsDisable(name) {

                return OnlineUser.some(UserInfo => {
                    return (UserInfo.name == name && UserInfo.Wait)
                })

            }

// #endregion

// Helper Functions
function Round(num) {
    return Math.round((num + Number.EPSILON) * 100) / 100
}
