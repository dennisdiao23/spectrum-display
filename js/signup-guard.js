/**
 * Block fake / generated signups before they hit Supabase Auth mail.
 * Keep this in sync with Auth.register (js/auth.js) — both must reject the same addresses.
 *
 * Why: confirmation mail goes out from noreply@mail.app.supabase.io. Generated
 * addresses like wallv2.*@spectrumdisplay.com bounce and can suspend sending.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.blockedSignupReason = api.blockedSignupReason;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  var STAFF_OK = {
    'dennisdiao@spectrumdisplay.com': true
  };

  var DISPOSABLE = {
    'example.com': true,
    'example.org': true,
    'example.net': true,
    'test.com': true,
    'mailinator.com': true,
    'guerrillamail.com': true,
    'yopmail.com': true,
    'tempmail.com': true,
    '10minutemail.com': true,
    'throwaway.email': true
  };

  var OBVIOUS_FAKE = {
    'a@a.com': true,
    'test@test.com': true,
    'foo@bar.com': true,
    'user@user.com': true
  };

  function blockedSignupReason(email) {
    var e = String(email || '').trim().toLowerCase();
    if (!e || e.indexOf('@') < 1) return 'Enter a valid email address.';
    var at = e.lastIndexOf('@');
    var local = e.slice(0, at);
    var domain = e.slice(at + 1);
    if (!local || !domain || domain.indexOf('.') < 1) return 'Enter a valid email address.';

    if (/^wallv2(\.|$)/.test(local) || local.indexOf('wallv2.') === 0) {
      return 'Use a real email address to create an account.';
    }

    if (domain === 'spectrumdisplay.com' && !STAFF_OK[e]) {
      return 'Use your own work email to create an account. @spectrumdisplay.com is not for customer signup.';
    }

    if (DISPOSABLE[domain] || OBVIOUS_FAKE[e]) {
      return 'Use a real email address to create an account.';
    }

    return '';
  }

  return { blockedSignupReason: blockedSignupReason };
});
