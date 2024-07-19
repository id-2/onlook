import * as Mixpanel from 'mixpanel';

class Analytics {
    mixpanel: ReturnType<typeof Mixpanel.init> | undefined;

    constructor() {
        try {
            this.mixpanel = Mixpanel.init(process.env.MIXPANEL_TOKEN || '');
        } catch (error) {
            console.error('Error initializing Mixpanel:', error);
            console.log('No Mixpanel client, your app not collect analytics');
        }
    }

    track(event: string, data?: Record<string, any>) {
        if (this.mixpanel) {
            // @ts-expect-error - type seems to be off
            this.mixpanel.track(event, data);
        }
    }
}

export default Analytics;
