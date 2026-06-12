@Library('jenkins-share-lib@main') _

def tikto = [:]
def sharedSecretEnv = []
def appSecretEnv = []
def imageRef = ''

pipeline {
    agent {
        label 'agent'
    }

    options {
        skipDefaultCheckout(true)
    }

    stages {
        stage('Prepare Pipeline') {
            steps {
                script {
                    tikto = tiktoBuildContext(deployBranches: ['main', 'dev'])

                    env.TIKTO_SHOULD_RUN = tikto.shouldRun.toString()
                    env.TIKTO_DEPLOY_BRANCH_BUILD = tikto.deployBranchBuild.toString()
                    env.TIKTO_SUPPORTED_PR = tikto.supportedPullRequest.toString()
                    env.TIKTO_BRANCH_NAME = tikto.branchName
                    env.TIKTO_CHANGE_TARGET = tikto.changeTarget
                    env.TIKTO_DEPLOY_ENV = tikto.deployEnv
                    env.TIKTO_MANIFEST_FILE = tikto.manifestFile
                    env.TIKTO_ARGO_APP_NAME = tikto.argoAppName

                    if (env.TIKTO_SHOULD_RUN != 'true') {
                        currentBuild.result = 'NOT_BUILT'
                        echo "Skip: only PRs targeting main/dev and branch builds on main/dev run this pipeline."
                    }
                }
            }
        }

        stage('Checkout') {
            when {
                expression { env.TIKTO_SHOULD_RUN == 'true' }
            }
            steps {
                checkout scm
            }
        }

        stage('Load Shared Secret') {
            when {
                expression { env.TIKTO_SHOULD_RUN == 'true' }
            }
            steps {
                script {
                    sharedSecretEnv = awsSecretEnv(tiktoSharedSecretId())
                }
            }
        }

        stage('Load App Secret') {
            when {
                expression { env.TIKTO_DEPLOY_BRANCH_BUILD == 'true' }
            }
            steps {
                script {
                    appSecretEnv = awsSecretEnv(tiktoAppSecretId(env.TIKTO_DEPLOY_ENV))
                }
            }
        }

        stage('Install Dependencies') {
            when {
                expression { env.TIKTO_SHOULD_RUN == 'true' }
            }
            steps {
                script {
                    withTiktoCiEnv(sharedSecretEnv: sharedSecretEnv, appSecretEnv: appSecretEnv) {
                        buildApp(wrapStage: false, language: 'shell', commands: ['npm ci'])
                    }
                }
            }
        }

        stage('Lint') {
            when {
                expression { env.TIKTO_SHOULD_RUN == 'true' }
            }
            steps {
                script {
                    withTiktoCiEnv(sharedSecretEnv: sharedSecretEnv, appSecretEnv: appSecretEnv) {
                        buildApp(wrapStage: false, language: 'shell', commands: ['npm run lint'])
                    }
                }
            }
        }

        stage('Typecheck') {
            when {
                expression { env.TIKTO_SHOULD_RUN == 'true' }
            }
            steps {
                script {
                    withTiktoCiEnv(sharedSecretEnv: sharedSecretEnv, appSecretEnv: appSecretEnv) {
                        buildApp(wrapStage: false, language: 'shell', commands: ['npm run typecheck'])
                    }
                }
            }
        }

        stage('Unit Tests') {
            when {
                expression { env.TIKTO_SHOULD_RUN == 'true' }
            }
            steps {
                script {
                    withTiktoCiEnv(sharedSecretEnv: sharedSecretEnv, appSecretEnv: appSecretEnv) {
                        testApp(wrapStage: false, language: 'shell', commands: ['npm run test:coverage'])
                    }
                }
            }
        }

        stage('Build App') {
            when {
                expression { env.TIKTO_SHOULD_RUN == 'true' }
            }
            steps {
                script {
                    withTiktoCiEnv(sharedSecretEnv: sharedSecretEnv, appSecretEnv: appSecretEnv) {
                        buildApp(wrapStage: false, language: 'shell', commands: ['npm run build'])
                    }
                }
            }
        }

        stage('SonarQube Cloud Scan') {
            when {
                expression { env.TIKTO_SHOULD_RUN == 'true' }
            }
            steps {
                script {
                    withTiktoCiEnv(sharedSecretEnv: sharedSecretEnv, appSecretEnv: appSecretEnv) {
                        sonarScan(
                            wrapStage: false,
                            language: 'shell',
                            commands: [tiktoSonarScannerCommand()],
                            sonarQubeEnv: env.SONAR_QUBE_ENV ?: env.SONARCLOUD_ENV ?: 'SonarCloud-Server',
                            sonarHostUrl: env.SONAR_HOST_URL ?: 'https://sonarcloud.io',
                            qualityGateEnabled: false
                        )
                    }

                    if (env.TIKTO_SUPPORTED_PR == 'true') {
                        echo "PR CI passed for PR #${env.CHANGE_ID} targeting ${env.TIKTO_CHANGE_TARGET}."
                    }
                }
            }
        }

        stage('Docker Build') {
            when {
                expression { env.TIKTO_DEPLOY_BRANCH_BUILD == 'true' }
            }
            steps {
                script {
                    withTiktoCiEnv(sharedSecretEnv: sharedSecretEnv, appSecretEnv: appSecretEnv) {
                        imageRef = dockerBuild(
                            wrapStage: false,
                            imageRepository: env.IMAGE_REPOSITORY ?: 'ghcr.io/flavoriy/tikto',
                            dockerfile: env.DOCKERFILE ?: 'Dockerfile',
                            context: env.DOCKER_CONTEXT ?: env.MY_DOCKER_CONTEXT ?: '.',
                            buildArgs: tiktoDockerBuildArgs()
                        )
                    }
                }
            }
        }

        stage('Trivy Image Scan') {
            when {
                expression { env.TIKTO_DEPLOY_BRANCH_BUILD == 'true' }
            }
            steps {
                script {
                    withTiktoCiEnv(sharedSecretEnv: sharedSecretEnv, appSecretEnv: appSecretEnv) {
                        trivyScan(wrapStage: false, imageRef: imageRef)
                    }
                }
            }
        }

        stage('Docker Push GHCR') {
            when {
                expression { env.TIKTO_DEPLOY_BRANCH_BUILD == 'true' }
            }
            steps {
                script {
                    withTiktoCiEnv(sharedSecretEnv: sharedSecretEnv, appSecretEnv: appSecretEnv) {
                        dockerPush(
                            wrapStage: false,
                            imageRef: imageRef,
                            registry: env.REGISTRY ?: 'ghcr.io',
                            credentialsId: env.GHCR_CREDENTIALS_ID ?: '',
                            credentialType: env.GHCR_CREDENTIAL_TYPE ?: 'secretText',
                            username: env.GHCR_USERNAME ?: env.REGISTRY_USERNAME ?: 'flavoriy'
                        )
                    }
                }
            }
        }

        stage('Update GitOps Manifest') {
            when {
                expression { env.TIKTO_DEPLOY_BRANCH_BUILD == 'true' }
            }
            steps {
                script {
                    withTiktoCiEnv(sharedSecretEnv: sharedSecretEnv, appSecretEnv: appSecretEnv) {
                        updateGitopsManifest(
                            wrapStage: false,
                            manifestRepoUrl: env.GITOPS_REPO_URL ?: 'https://github.com/Flavoriy/gitops-manifest.git',
                            manifestBranch: env.GITOPS_BRANCH ?: 'main',
                            manifestFile: env.TIKTO_MANIFEST_FILE,
                            manifestGitCredentialsId: env.GITOPS_CREDENTIALS_ID ?: '',
                            imageRef: imageRef,
                            imageRepository: env.IMAGE_REPOSITORY ?: 'ghcr.io/flavoriy/tikto',
                            gitUsername: env.GITOPS_USERNAME ?: env.GIT_USERNAME ?: 'x-access-token',
                            commitMessage: "chore(${env.TIKTO_DEPLOY_ENV}): deploy ${imageRef}"
                        )
                    }
                }
            }
        }

        stage('Verify ArgoCD') {
            when {
                expression { env.TIKTO_DEPLOY_BRANCH_BUILD == 'true' }
            }
            steps {
                script {
                    if (env.ARGOCD_SERVER?.trim()) {
                        withTiktoCiEnv(sharedSecretEnv: sharedSecretEnv, appSecretEnv: appSecretEnv) {
                            verifyArgoApp(
                                wrapStage: false,
                                appName: env.TIKTO_ARGO_APP_NAME,
                                server: env.ARGOCD_SERVER,
                                tokenCredentialsId: env.ARGOCD_TOKEN_CREDENTIALS_ID ?: '',
                                imageRef: imageRef,
                                insecure: (env.ARGOCD_INSECURE ?: 'false').toBoolean()
                            )
                        }
                    } else {
                        echo 'Skip ArgoCD verify: ARGOCD_SERVER is not configured. ArgoCD will deploy from the updated GitOps manifest.'
                    }
                }
            }
        }
    }
}
