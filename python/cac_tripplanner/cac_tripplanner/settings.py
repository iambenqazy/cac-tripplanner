"""
Django settings for cac_tripplanner project.

For more information on this file, see
https://docs.djangoproject.com/en/1.7/topics/settings/

For the full list of settings and their values, see
https://docs.djangoproject.com/en/1.7/ref/settings/
"""

# Build paths inside the project like this: os.path.join(BASE_DIR, ...)
import os
import yaml
BASE_DIR = os.path.dirname(os.path.dirname(__file__))

try:
    secrets = yaml.safe_load(open('/etc/cac_secrets', 'r'))
except (IOError, NameError):
    secrets = {
        'secret_key': '%&_DEVELOPMENT_SECRET_KEY_#42*pk!3y6lvk&1psyk=e=pr',
        'database': {
            'ENGINE': 'django.contrib.gis.db.backends.postgis',
            'NAME': 'cac_tripplanner',
            'USER': 'cac_tripplanner',
            'PASSWORD': 'cac_tripplanner',
            'HOST': '127.0.0.1',
            'PORT': '5432'
        },
        'production': False
    }

# Quick-start development settings - unsuitable for production
# See https://docs.djangoproject.com/en/1.7/howto/deployment/checklist/

# SECURITY WARNING: keep the secret key used in production secret!
SECRET_KEY = secrets['secret_key']

# SECURITY WARNING: don't run with debug turned on in production!
DEBUG = not secrets['production']

TEMPLATE_DEBUG = not secrets['production']

ALLOWED_HOSTS = []


# Application definition

INSTALLED_APPS = (
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
)

MIDDLEWARE_CLASSES = (
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.auth.middleware.SessionAuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
)

ROOT_URLCONF = 'cac_tripplanner.urls'

WSGI_APPLICATION = 'cac_tripplanner.wsgi.application'


# Database
# https://docs.djangoproject.com/en/1.7/ref/settings/#databases

DATABASES = {
    'default': secrets['database']
}

# Internationalization
# https://docs.djangoproject.com/en/1.7/topics/i18n/

LANGUAGE_CODE = 'en-us'

TIME_ZONE = 'UTC'

USE_I18N = True

USE_L10N = True

USE_TZ = True


# Static files (CSS, JavaScript, Images)
# https://docs.djangoproject.com/en/1.7/howto/static-files/

STATIC_URL = '/static/'
