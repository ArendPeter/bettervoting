export interface Imsg {
    to: string;
    from: string;
    subject: string,
    text: string,
    html: string,
    asm?: {groupId: number}
    mail_settings?: {
        sandbox_mode?: {
            enable: boolean
        }
    }
};