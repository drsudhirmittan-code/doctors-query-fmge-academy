const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const FRONTEND = path.join(ROOT, 'Doctors_Query_FMGE_Academy_V18_SECURE_DATABASE.html');

if (!fs.existsSync(FRONTEND)) process.exit(0);

let html = fs.readFileSync(FRONTEND, 'utf8');

if (!html.includes('DQ_V32_A1_1_DYNAMIC_EMAIL_OTP_UI')) {
  const ui = String.raw`<!-- DQ_V32_A1_1_DYNAMIC_EMAIL_OTP_UI -->
<script>
(function () {
  if (window.__DQ_V32_A1_1_LOADED) return;
  window.__DQ_V32_A1_1_LOADED = true;

  var verifiedEmail = "";
  var attachedForms = new WeakSet();

  function getEmailInput(form) {
    if (!form) return null;
    var selectors = [
      'input[name="email"]',
      'input[type="email"]',
      'input[autocomplete="email"]'
    ];
    for (var i = 0; i < selectors.length; i++) {
      var el = form.querySelector(selectors[i]);
      if (el) return el;
    }
    var inputs = Array.prototype.slice.call(form.querySelectorAll('input'));
    return inputs.find(function (el) {
      var label = ((el.getAttribute('aria-label') || '') + ' ' + (el.placeholder || '')).toLowerCase();
      return label.indexOf('email') >= 0;
    }) || null;
  }

  function findRegistrationForms() {
    var forms = Array.prototype.slice.call(document.querySelectorAll('form'));
    return forms.filter(function (form) {
      return !!getEmailInput(form);
    });
  }

  function setMessage(box, text, ok) {
    var msg = box.querySelector('.dq-ev-msg');
    if (!msg) return;
    msg.textContent = text;
    msg.className = 'dq-ev-msg ' + (ok ? 'dq-ev-ok' : 'dq-ev-err');
  }

  function attach(form) {
    if (!form || attachedForms.has(form)) return;
    var email = getEmailInput(form);
    if (!email) return;

    if (form.querySelector('.dq-email-verify')) {
      attachedForms.add(form);
      return;
    }

    attachedForms.add(form);

    var box = document.createElement('div');
    box.className = 'dq-email-verify';
    box.innerHTML =
      '<strong>Verify your email before payment</strong>' +
      '<div style="font-size:13px;margin:5px 0 10px">A 6-digit OTP will be sent to your email address.</div>' +
      '<div class="dq-ev-row">' +
        '<input id="dq-ev-otp-dynamic" inputmode="numeric" maxlength="6" placeholder="Enter 6-digit OTP" autocomplete="one-time-code" style="display:none">' +
        '<button type="button" id="dq-ev-send-dynamic">Send OTP</button>' +
        '<button type="button" id="dq-ev-verify-dynamic" style="display:none">Verify OTP</button>' +
      '</div>' +
      '<div class="dq-ev-msg"></div>';

    email.insertAdjacentElement('afterend', box);

    var otp = box.querySelector('#dq-ev-otp-dynamic');
    var send = box.querySelector('#dq-ev-send-dynamic');
    var verify = box.querySelector('#dq-ev-verify-dynamic');
    var busy = false;

    function emailValue() {
      return String(email.value || '').trim();
    }

    function validEmail(value) {
      return /^\S+@\S+\.\S+$/.test(value);
    }

    // V32-A.1.1 correction: students must be able to fill ALL registration
    // details before/while verifying email. Only payment/submission is blocked
    // until the email OTP is successfully verified.
    function lockForm(lock) {
      Array.prototype.slice.call(form.querySelectorAll('input,select,textarea,button')).forEach(function (el) {
        if (el === email || box.contains(el)) return;
        el.disabled = !!lock;
      });
    }

    // Do NOT lock the registration form before OTP. Name, WhatsApp, country,
    // university and year must remain editable. Server-side payment guard is
    // the final enforcement point.

    send.addEventListener('click', async function () {
      var value = emailValue();
      if (!validEmail(value)) {
        setMessage(box, 'Please enter a valid email address.', false);
        return;
      }
      if (busy) return;
      busy = true;
      send.disabled = true;
      setMessage(box, 'Sending verification OTP…', true);
      try {
        var response = await fetch('/api/registration/send-email-otp', {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: value })
        });
        var data = await response.json().catch(function () { return {}; });
        if (!response.ok) throw new Error(data.error || 'Unable to send OTP.');
        otp.style.display = 'block';
        verify.style.display = 'inline-block';
        setMessage(box, data.message || 'OTP sent. Please check your email.', true);
      } catch (e) {
        setMessage(box, e.message || 'Unable to send OTP. Please check your email address.', false);
      } finally {
        busy = false;
        send.disabled = false;
      }
    });

    verify.addEventListener('click', async function () {
      var value = emailValue();
      var code = String(otp.value || '').trim();
      if (!validEmail(value)) {
        setMessage(box, 'Please enter a valid email address.', false);
        return;
      }
      if (!/^\d{6}$/.test(code)) {
        setMessage(box, 'Enter the 6-digit OTP sent to your email.', false);
        return;
      }
      if (busy) return;
      busy = true;
      verify.disabled = true;
      setMessage(box, 'Verifying email…', true);
      try {
        var response = await fetch('/api/registration/verify-email-otp', {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: value, otp: code })
        });
        var data = await response.json().catch(function () { return {}; });
        if (!response.ok) throw new Error(data.error || 'OTP verification failed.');
        verifiedEmail = value.toLowerCase();
        email.readOnly = true;
        otp.disabled = true;
        verify.disabled = true;
        send.disabled = true;
        lockForm(false);
        setMessage(box, '✓ Email verified successfully. You can now complete the registration and continue to payment.', true);
      } catch (e) {
        verify.disabled = false;
        setMessage(box, e.message || 'Incorrect or expired OTP. Please request a new OTP.', false);
      } finally {
        busy = false;
      }
    });

    form.addEventListener('submit', function (event) {
      var value = emailValue().toLowerCase();
      if (!verifiedEmail || value !== verifiedEmail) {
        event.preventDefault();
        event.stopImmediatePropagation();
        setMessage(box, 'Please verify your email address before continuing to payment.', false);
      }
    }, true);
  }

  function scan() {
    findRegistrationForms().forEach(attach);
  }

  function wrapPayment() {
    if (typeof window.startDQPayment !== 'function' || window.__DQ_V32_A1_1_PAYMENT_WRAPPED) return;
    var original = window.startDQPayment;
    window.__DQ_V32_A1_1_PAYMENT_WRAPPED = true;
    window.startDQPayment = async function (form) {
      var email = getEmailInput(form);
      var value = email ? String(email.value || '').trim().toLowerCase() : '';
      if (!verifiedEmail || value !== verifiedEmail) {
        var box = form && form.querySelector ? form.querySelector('.dq-email-verify') : null;
        if (box) {
          setMessage(box, 'Please verify your email address before continuing to payment.', false);
          box.scrollIntoView({ behavior: 'smooth', block: 'center' });
        } else {
          alert('Please verify your email address before continuing to payment.');
        }
        return false;
      }
      return original(form);
    };
  }

  function boot() {
    scan();
    wrapPayment();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  var observer = new MutationObserver(function () {
    boot();
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });

  document.addEventListener('click', function () {
    setTimeout(boot, 0);
    setTimeout(boot, 150);
  }, true);
})();
</script>`;

  html = html.replace('</body>', ui + '\n</body>');
  fs.writeFileSync(FRONTEND, html, 'utf8');
}

console.log('Applied Doctors Query FMGE Academy V32-A.1.1 dynamic Email OTP UI patch.');
