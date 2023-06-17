import { Uid } from "./Uid";
// Election roll contains information about the voter's ID and ballot status to ensure only
// authorized voters submit a single ballot
export interface ElectionRoll {
    voter_id: Uid; //Unique ID of voter who cast ballot
    election_id: Uid; //ID of election ballot is cast in
    email?: string; // Email address of voter
    submitted: boolean; //has ballot been submitted
    ballot_id?:  Uid; //ID of ballot, unsure if this is needed
    ip_address?: string; //IP Address of voter
    address?: string; // Address of voter
    state: ElectionRollState; //state of election roll 
    history?: ElectionRollAction[];// history of changes to election roll
    registration?: any; //Registration data for voter
    precinct?: string; // Precint of voter
    email_data?: {
        inviteResponse?: any,
        reminderResponse?: any,
    }
}

export interface ElectionRollAction {
    action_type:string;
    actor:Uid;
    timestamp:number;
}

export const ElectionStates = {}

export enum ElectionRollState {
    approved= 'approved',
    flagged = 'flagged',
    registered = 'registered',
    invalid = 'invalid'
}

export function electionRollValidation(obj:ElectionRoll): string | null {
    if (!obj){
        return "ElectionRoll is null";
    }
    if (typeof obj.voter_id !== 'string'){
        return "Invalid Election Roll ID";
    }
    if (typeof obj.election_id !== 'string'){
        return "Invalid Election ID";
    }
    if (typeof obj.submitted !== 'boolean'){
        return "Invalid Submitted";
    }
    //TODO... etc
    return null;
}