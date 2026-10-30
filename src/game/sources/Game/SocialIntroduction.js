import { SOCIAL_TEAM_NAME } from '../data/social.js'
import { t } from '../Career/i18n.js'

/** Content for the shared team dialog; the existing Modals owns its lifecycle. */
export class SocialIntroduction
{
    constructor(element)
    {
        this.element = element
        this.team = element.querySelector('.js-social-team')
        this.platform = element.querySelector('.js-social-platform')
        this.description = element.querySelector('.js-social-description')
        this.link = element.querySelector('.js-social-link')
        this.close = element.querySelector('.js-close')
    }

    show(contact)
    {
        this.team.textContent = SOCIAL_TEAM_NAME
        this.platform.textContent = contact.name === 'Mail' ? t('social.email') : contact.name
        this.description.textContent = contact.url
            ? t('social.repositoryDescription', { team: SOCIAL_TEAM_NAME })
            : t('social.notProvided')
        this.close.setAttribute('aria-label', t('common.close'))
        this.link.hidden = !contact.url
        if(contact.url)
        {
            this.link.href = contact.url
            this.link.textContent = t('social.viewRepository')
        }
        else
        {
            this.link.removeAttribute('href')
            this.link.textContent = ''
        }
    }
}
