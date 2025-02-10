import { NewBallot, NewBallotWithVoterID } from "@equal-vote/star-vote-shared/domain_model/Ballot";
import { Election } from "@equal-vote/star-vote-shared/domain_model/Election";

/* 
    Example Input (assuming papa parse)

    {
        data: [
           {ballotID: 7, ward: 400, rank1: 'Terry Seamens', rank2: 'Terry Seamens'} ,
           {ballotID: 8, ward: 400, rank1: 'Terry Seamens', rank2: 'skipped'},
           ...
        ],
        meta: [fields: ['ballotID', 'ward', 'rank1', 'rank2']]
        errors:[{
            code: "TooFewFields"
            message: "Too few fields: expected 4 fields but parsed 1"
            row: 576
            type: "FieldMismatch"
        }]
    }
*/

// ported from https://github.com/fairvotereform/rcv_cruncher/blob/9bb9f8482290033ff7b31d6b091186474e7afff6/src/rcv_cruncher/parsers.py
export const rankColumnCSV = ({data, meta, errors}, election: Election) : {ballots: NewBallot[], errors:object[]} => {
    const errorRows = new Set(errors.map(error => error.row))
    const rankFields = meta.fields.filter((field:string) => field.startsWith('rank'));

    let ballots = data.map((row,i) => {
        if(errorRows.has(i)) return;
        // TODO: this currently doesn't handle overvotes or duplicate ranks
        // TODO: add try catch for adding errors
        let invRow = rankFields.reduce((obj, key) => {
            obj[row[key]] = Number(key.replace('rank', ''));
            return obj;
        }, {})
        return {
            election_id: election.election_id,
            status: 'submitted',
            date_submitted: Date.now(),
            votes: [
                {
                    race_id: election.races[0].race_id,
                    scores: election.races[0].candidates.map(c => {
                        let ranking = invRow[c.candidate_name];
                        return {
                            candidate_id: c.candidate_id,
                            score: ranking ? ranking : null
                        }
                    })
                }
            ]
        }
    })

    return {ballots, errors};
}