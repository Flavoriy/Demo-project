@Library('jenkins-share-lib@main') _

pipeline {
    agent {
        label 'jenkins-agent'
    }

    options {
        skipDefaultCheckout(true)
    }

    environment {
        CI = 'true'
        NEXT_TELEMETRY_DISABLED = '1'
        REGISTRY = 'ghcr.io'
        IMAGE_REPOSITORY = 'ghcr.io/flavoriy/tikto'
        IMAGE_VERSION_PREFIX = '1.0'
        IMAGE_EXTRA_TAG = 'latest'
        DOCKERFILE = 'Dockerfile'
        MY_DOCKER_CONTEXT = '.'
    }

    stages {
        stage('Checkout') {
            steps {
                checkout scm
            }
        }

        stage('Prepare Image Tag') {
            steps {
                script {
                    image = prepareDockerImageRefs(
                        imageRepository: env.IMAGE_REPOSITORY,
                        imageVersionPrefix: env.IMAGE_VERSION_PREFIX,
                        extraTags: [env.IMAGE_EXTRA_TAG]
                    )
                }
            }
        }

        stage('Docker Build') {
            steps {
                script {
                    dockerBuild(
                        wrapStage: false,
                        imageRepository: env.IMAGE_REPOSITORY,
                        imageTag: env.IMAGE_TAG,
                        additionalImageRefs: image.additionalImageRefs,
                        dockerfile: env.DOCKERFILE,
                        context: env.MY_DOCKER_CONTEXT,
                        buildArgs: ['--build-arg DATABASE_URL="$DATABASE_URL"'],
                        secretEnvFileCredentialsId: 'tikto'
                    )
                }
            }
        }

        stage('Docker Push GHCR') {
            steps {
                script {
                    dockerPush(
                        wrapStage: false,
                        imageRef: image.imageRef,
                        additionalImageRefs: image.additionalImageRefs,
                        registry: env.REGISTRY,
                        credentialsId: 'ghcr-token',
                        credentialType: 'string',
                        username: 'flavoriy'
                    )
                }
            }
        }
    }
}
