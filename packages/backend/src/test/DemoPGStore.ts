export class DemoPGStore {

    _postgresClient;
    _tableName:string;

    constructor(client:any, tableName:string) {
        this._postgresClient = client;
        this._tableName = tableName;
    }

    init():Promise<DemoPGStore> {
        console.log("DemoPGStore.init");
		var query = `
        CREATE TABLE IF NOT EXISTS ${this._tableName} (
            id SERIAL PRIMARY KEY,
            key VARCHAR UNIQUE,
            val VARCHAR 
          );
        `;
        console.log(query);
        var p =  this._postgresClient.query(query);
        return p.then((_: any) => {
            return this;
          });
    }


    set(key:string, value:string):Promise<string> {
        console.log(`DemoPGStore.set ${key} -> ${value}`);
        var sqlString = `INSERT INTO ${this._tableName} (key, val)
        VALUES($1, $2)
        ON CONFLICT (key) 
        DO UPDATE SET val = $2;`;

        var p =  this._postgresClient.query({
            rowMode: 'array',
            text: sqlString,
            values: [key, value]
        });
        return p.then((res: any) => {
            console.log("set response rows: " + JSON.stringify(res));
            return value;
          });
    }

    get(key:string):Promise<string | null> {
        console.log(`DemoPGStore.get ${key}`);
        var sqlString = `SELECT * FROM ${this._tableName} WHERE key = $1`;
        console.log(sqlString);

        var p =  this._postgresClient.query({
            rowMode: 'array',
            text: sqlString,
            values: [key]
        });
        return p.then((response: any) => {
            var rows = response.rows;
            if (rows.length == 0){
                console.log(".get null");
                return null;
            }
            return rows[0][2];
        });
    }

    delete(key:string):Promise<boolean> {
        console.log(`DemoPGStore.delete ${key}`);
        var sqlString = `DELETE FROM ${this._tableName} WHERE key = $1`;
        console.log(sqlString);

        var p =  this._postgresClient.query({
            rowMode: 'array',
            text: sqlString,
            values: [key]
        });
        return p.then((response: any) => {
            if (response.rowCount == 1){
                return true;
            }
            return false;
        });
    }
}