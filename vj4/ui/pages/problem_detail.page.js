import Tether from 'tether';
import { NamedPage } from 'vj/misc/PageLoader';
import Navigation from 'vj/components/navigation';
import loadReactRedux from 'vj/utils/loadReactRedux';
import delay from 'vj/utils/delay';

class ProblemPageExtender {
  constructor() {
    this.isExtended = false;
    this.inProgress = false;
    this.$content = $('.problem-content');
    this.$contentBound = this.$content.closest('.section');
    this.$scratchpadContainer = $('.scratchpad-container');
  }
  async extend() {
    if (this.inProgress) {
      return;
    }
    if (this.isExtended) {
      return;
    }
    this.inProgress = true;

    const bound = this.$contentBound
      .get(0)
      .getBoundingClientRect();

    this.$content.transition({ opacity: 0 }, { duration: 100 });
    await delay(100);

    Navigation.instance.floating.set('scratchpad', true);
    Navigation.instance.logoVisible.set('scratchpad', true);
    Navigation.instance.expanded.set('scratchpad', true);
    $('body').addClass('header--collapsed mode--scratchpad');

    await this.$scratchpadContainer
      .css({
        left: bound.left,
        top: bound.top,
        width: bound.width,
        height: bound.height,
      })
      .show()
      .transition({
        left: 0,
        top: 0,
        width: '100%',
        height: '100%',
      }, {
        duration: 500,
        easing: 'easeOutCubic',
      })
      .promise();

    $('.main > .row').hide();
    $('.footer').hide();
    $(window).scrollTop(0);

    this.inProgress = false;
    this.isExtended = true;
  }

  async collapse() {
    if (this.inProgress) {
      return;
    }
    if (!this.isExtended) {
      return;
    }
    this.inProgress = true;

    $(window).scrollTop(0);
    $('.main > .row').show();
    $('.footer').show();

    const bound = this.$contentBound
      .get(0)
      .getBoundingClientRect();

    Navigation.instance.floating.set('scratchpad', false);
    Navigation.instance.logoVisible.set('scratchpad', false);
    Navigation.instance.expanded.set('scratchpad', false);

    $('body').removeClass('header--collapsed mode--scratchpad');

    await this.$scratchpadContainer
      .transition({
        left: bound.left,
        top: bound.top,
        width: bound.width,
        height: bound.height,
      }, {
        duration: 500,
        easing: 'easeOutCubic',
      })
      .promise();

    this.$scratchpadContainer.hide();
    this.$content.transition({ opacity: 1 }, { duration: 100 });

    this.inProgress = false;
    this.isExtended = false;
  }

  toggle() {
    if (this.isExtended) {
      this.collapse();
    } else {
      this.extend();
    }
  }

}

const page = new NamedPage(['problem_detail', 'contest_detail_problem'], () => {
  let componentMounted = false;
  let $floatingSidebar = null;
  let reduxStore = null;
  const extender = new ProblemPageExtender();

  async function scratchpadFadeIn() {
    await $('#scratchpad')
      .transition({
        opacity: 1,
      }, {
        duration: 200,
        easing: 'easeOutCubic',
      })
      .promise();
  }

  async function scratchpadFadeOut() {
    await $('#scratchpad')
      .transition({
        opacity: 0,
      }, {
        duration: 200,
        easing: 'easeOutCubic',
      })
      .promise();
  }

  function updateFloatingSidebar() {
    $floatingSidebar.tether.position();
  }

  async function createSidebar() {
    $floatingSidebar = $('.section--problem-sidebar')
      .clone()
      .addClass('scratchpad__sidebar visible')
      .appendTo('body');
    $floatingSidebar.find('a').attr('target', '_blank');
    $floatingSidebar.tether = new Tether({
      element: $floatingSidebar,
      offset: '-20px 20px',
      target: '.scratchpad__problem',
      attachment: 'top right',
      targetAttachment: 'top right',
    });
    await delay(100);
    $floatingSidebar.tether.position();
  }

  async function removeSidebar() {
    $floatingSidebar.tether.destroy();
    $floatingSidebar.remove();
    $floatingSidebar = null;
  }

  async function mountComponent() {
    if (componentMounted) {
      return;
    }

    $('.loader-container').show();

    const SockJs = await System.import('sockjs-client');
    const { default: ScratchpadApp } = await System.import('../components/scratchpad');
    const { default: ScratchpadReducer } = await System.import('../components/scratchpad/reducers');
    const { React, render, Provider, store } = await loadReactRedux(ScratchpadReducer);

    const sock = new SockJs(Context.socketUrl);
    sock.onmessage = (message) => {
      const msg = JSON.parse(message.data);
      store.dispatch({
        type: 'SCRATCHPAD_RECORDS_PUSH',
        payload: msg,
      });
    };

    reduxStore = store;

    render(
      <Provider store={store}>
        <ScratchpadApp />
      </Provider>,
      $('#scratchpad').get(0),
    );
    componentMounted = true;

    $('.loader-container').hide();
  }

  // Sync markers
  function syncHtmlFromDomToReact() {
    const html = $('.problem-content').html();
    reduxStore.dispatch({
      type: 'SCRATCHPAD_PROBLEM_SET_HTML',
      payload: html,
    });
  }
  function syncHtmlFromReactToDom() {
    const html = $('.scratchpad__problem').html();
    $('.problem-content').html(html);
  }

  async function enterScratchpadMode() {
    await extender.extend();
    await mountComponent();
    syncHtmlFromDomToReact();
    await scratchpadFadeIn();
    await createSidebar();
  }

  async function leaveScratchpadMode() {
    syncHtmlFromReactToDom();
    await removeSidebar();
    await scratchpadFadeOut();
    await extender.collapse();
  }

  $(document).on('vjScratchpadRelayout', updateFloatingSidebar);
  $(document).on('click', '[name="problem-sidebar__open-scratchpad"]', (ev) => {
    enterScratchpadMode();
    ev.preventDefault();
  });
  $(document).on('click', '[name="problem-sidebar__quit-scratchpad"]', (ev) => {
    leaveScratchpadMode();
    ev.preventDefault();
  });
});

export default page;
