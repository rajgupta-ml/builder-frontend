import {
    CognitoUser,
    CognitoUserPool,
    AuthenticationDetails,
} from 'amazon-cognito-identity-js';

const getUserPool = () =>
    new CognitoUserPool({
        UserPoolId: process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID!,
        ClientId: process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID!,
    });

export { CognitoUser };

export type SignInResult =
    | { newPasswordRequired: true; cognitoUser: CognitoUser }
    | { idToken: string };

export function signIn(email: string, password: string): Promise<SignInResult> {
    return new Promise((resolve, reject) => {
        const userPool = getUserPool();
        const cognitoUser = new CognitoUser({ Username: email, Pool: userPool });
        const authDetails = new AuthenticationDetails({ Username: email, Password: password });

        cognitoUser.authenticateUser(authDetails, {
            onSuccess(session) {
                resolve({ idToken: session.getIdToken().getJwtToken() });
            },
            onFailure(err) {
                reject(err);
            },
            newPasswordRequired(_userAttributes, _requiredAttributes) {
                resolve({ newPasswordRequired: true, cognitoUser });
            },
        });
    });
}

export function completeNewPassword(
    cognitoUser: CognitoUser,
    newPassword: string
): Promise<{ idToken: string }> {
    return new Promise((resolve, reject) => {
        cognitoUser.completeNewPasswordChallenge(newPassword, {}, {
            onSuccess(session) {
                resolve({ idToken: session.getIdToken().getJwtToken() });
            },
            onFailure(err) {
                reject(err);
            },
        });
    });
}

export function refreshSession(): Promise<string> {
    return new Promise((resolve, reject) => {
        const userPool = getUserPool();
        const cognitoUser = userPool.getCurrentUser();
        if (!cognitoUser) {
            reject(new Error('No current user'));
            return;
        }
        cognitoUser.getSession((err: Error | null, session: any) => {
            if (err || !session) {
                reject(err || new Error('No session'));
                return;
            }
            cognitoUser.refreshSession(session.getRefreshToken(), (refreshErr: Error | null, newSession: any) => {
                if (refreshErr || !newSession) {
                    reject(refreshErr || new Error('Refresh failed'));
                    return;
                }
                resolve(newSession.getIdToken().getJwtToken());
            });
        });
    });
}

export function signOut(): void {
    const userPool = getUserPool();
    const cognitoUser = userPool.getCurrentUser();
    cognitoUser?.signOut();
}
