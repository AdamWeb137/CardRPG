function game_main(){
    //"global" variables but actually not global since in function
    const random_list = (list)=>{
        let i = Math.floor(Math.random()*list.length);
        return list[i];
    }

    const Player = new_struct(["name","string"],["color","string"],["alive","boolean"]);
    let players = [];
    const get_alive_players = function*(){
        for(let i = 0; i < players.length; i++){
            let player = players[i];
            if(player.alive) yield {i:i,player:player};
        }
    };

    const Action = new_struct(["description","string"],["player","object"]);
    let actions = [];

    const reload_all = ()=>{
        for(let scope of Radial.scope_names){
            document.querySelector(`[scope="${scope}"]`).reload();
        }
    };

    const reload_except = (excluded_scope)=>{
        for(let scope of Radial.scope_names){
            if(scope != excluded_scope)document.querySelector(`[scope="${scope}"]`).reload();
        }
    };

    let game_info = {winner:false,created_players:false};

    Radial.create_scope("actions",function(scope){
        scope.actions = actions;
        scope.dead_color = "#6a040f";
        scope.dead_or_alive = (action,type)=>{
            let alive_color = (type == "name") ? action.player.color : "var(--text)";
            if(action.player.alive) return alive_color;
            return scope.dead_color;
        };
    });

    Radial.create_scope("new_action",function(scope){

        scope.can_render = ()=>{
            return (scope.game_info.winner == false && scope.game_info.created_players == true);
        };

        let i = 0;
        scope.player = null;
        scope.mode = "draw";
        scope.action_desc = "";
        scope.kill_off = "-1";
        scope.game_info = game_info;

        scope.luck = "Very Lucky";
        scope.card_desc = "7";
        scope.card_type = "spades";
        scope.card_back = "black";
        scope.new_card = ()=>{
            let descs = ["2","3","4","5","6","7","8","9","10","jack","queen","king","ace"];
            let lucks = ["very unlucky","very unlucky","unlucky","unlucky","unlucky","mildly lucky","mildly lucky","lucky","lucky","lucky","very lucky","very lucky","wish granted"];
            let randi = Math.floor(Math.random()*descs.length);

            scope.card_desc = descs[randi];
            scope.luck = lucks[randi];

            scope.card_type = random_list(["spades","hearts","diamonds","clubs"]);
            scope.card_back = (scope.card_type == "hearts" || scope.card_type == "diamonds") ? "black" : "red";

        };

        scope.change_mode = (event,new_mode)=>{
            scope.mode = new_mode;
            if(new_mode == "add")scope.new_card();
        };

        scope.get_select = ()=>{
            let html = `<option value="-1">No one</option>`;
            for(let info of get_alive_players()){
                html += `<option value="${info.i}">${scope.clean(info.player.name)}</option>`;
            }
            return html;
        };

        scope.get_next_alive = ()=>{
            for(let j=1; j < players.length; j++){
                let index = (i+j)%players.length;
                // console.log(players[index]);
                if(players[index].alive){
                    i = index;
                    scope.player = players[index];
                    return;
                }
            }
        };

        scope.get_alive = ()=>{
            let alive = [];
            for(let i = 0; i < players.length; i++){
                if(players[i].alive) alive.push(players[i]);
            }
            return alive;
        };

        scope.add_action = ()=>{

            if(scope.action_desc.length == 0){
                alert("Must add action");
                return;
            }

            actions.push(Action(scope.action_desc,scope.player));

            let load_all = false;
            let kill_i = Number(scope.kill_off);
            if(scope.kill_off == "") kill_i = -1;
            if(kill_i > -1){
                players[kill_i].alive = false;
                let alive = scope.get_alive();
                if(alive.length == 1){
                    scope.game_info.winner = alive[0].name;
                    load_all = true;
                }
            }
            scope.get_next_alive();
            scope.new_card();
            if(!load_all){
                document.querySelector("rad-ial[scope='actions']").reload();
                scope.mode = "draw";
            }
            if(load_all)reload_except("new_action");
            scope.action_desc = "";
            scope.kill_off = "-1";
            let actions_div = document.querySelector(".actions_loop");
            actions_div.scrollTop = actions_div.scrollHeight; 
        };

    });

    Radial.create_scope("winner",function(scope){
        scope.game_info = game_info;
        scope.play_again_new = (event)=>{
            window.location.reload();
        };
        scope.play_again_old = (event)=>{
            scope.game_info.winner = false;
            scope.game_info.created_players = true;
            for(let i = 0; i < players.length; i++){
                players[i].alive = true;
            }
            actions = [];
            Radial.scopes["actions"].actions = actions;
            Radial.scopes["new_action"].kill_off = "-1";
            reload_except("winner");
        };
    });

    Radial.create_scope("create_players",function(scope){
        scope.game_info = game_info;
        scope.players = players;
        scope.name = "";

        scope.colors = ["green","red","blue","pink","yellow"];
        let col_i = 0;

        scope.player_already_exists = ()=>{
            return scope.players.find(function(element,index){
                return element.name == scope.name;
            });
        };

        scope.add_player = ()=>{
            if(scope.name.length == 0){
                alert("Must input player name");
                return;
            }
            if(scope.player_already_exists()){
                alert("That player already exists");
                return;
            }
            col_i = (col_i+1)%scope.colors.length;
            scope.players.push(Player(scope.name,scope.colors[col_i],true));
            scope.name = "";
        };

        scope.start_game = (event)=>{
            scope.game_info.created_players = true;
            Radial.scopes["new_action"].player = players[0];
            reload_except("create_players");
        };

    });

}
game_main();