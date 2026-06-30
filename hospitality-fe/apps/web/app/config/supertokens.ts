import SuperTokens from 'supertokens-auth-react';
import EmailPassword from 'supertokens-auth-react/recipe/emailpassword';
import Session from 'supertokens-auth-react/recipe/session';

export const initSuperTokens = () => {
  if (typeof window !== 'undefined') {
    SuperTokens.init({
      appInfo: {
        appName: 'Hospitality Elite',
        apiDomain: window.location.origin,
        websiteDomain: window.location.origin,
        apiBasePath: '/auth',
        websiteBasePath: '/auth',
      },
      recipeList: [
        EmailPassword.init(),
        Session.init(),
      ],
    });
  }
};
