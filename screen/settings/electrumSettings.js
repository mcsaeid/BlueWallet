/* global alert */
import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { Alert, View, TextInput, TouchableOpacity, LayoutAnimation, StyleSheet, Keyboard, Platform } from 'react-native';
import DefaultPreference from 'react-native-default-preference';
import RNWidgetCenter from 'react-native-widget-center';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ScrollView, TouchableWithoutFeedback } from 'react-native-gesture-handler';
import showPopupMenu from 'react-native-popup-menu-android';
import loc from '../../loc';
import { AppStorage } from '../../class';
import DeeplinkSchemaMatch from '../../class/deeplink-schema-match';
import navigationStyle from '../../components/navigationStyle';
import {
  BlueAddressInput,
  BlueButton,
  BlueCard,
  BlueDismissKeyboardInputAccessory,
  BlueLoading,
  BlueSpacing20,
  BlueText,
  SafeBlueArea,
} from '../../BlueComponents';
import { BlueCurrentTheme } from '../../components/themes';
import ToolTip from 'react-native-tooltip';
import Clipboard from '@react-native-community/clipboard';
import { Icon } from 'react-native-elements';

const BlueElectrum = require('../../blue_modules/BlueElectrum');

export default class ElectrumSettings extends Component {
  tooltip = React.createRef();
  hostText = React.createRef();

  constructor(props) {
    super(props);
    const server = props?.route?.params?.server;
    this.state = {
      isLoading: true,
      serverHistory: [],
      config: {},
      server,
      defaultPreferenceServer: {},
    };
  }

  componentWillUnmount() {
    clearInterval(this.state.inverval);
  }

  async componentDidMount() {
    const host = await AsyncStorage.getItem(AppStorage.ELECTRUM_HOST);
    const port = await AsyncStorage.getItem(AppStorage.ELECTRUM_TCP_PORT);
    const sslPort = await AsyncStorage.getItem(AppStorage.ELECTRUM_SSL_PORT);
    const serverHistoryStr = await AsyncStorage.getItem(AppStorage.ELECTRUM_SERVER_HISTORY);
    const serverHistory = JSON.parse(serverHistoryStr) || [];
    const defaultPreferenceServer = { host, port, sslPort };
    try {
      const defaultPreferenceHost = await DefaultPreference.get(AppStorage.ELECTRUM_HOST);
      const defaultPreferencePort = await DefaultPreference.get(AppStorage.ELECTRUM_TCP_PORT);
      const defaultPreferenceSSLPort = await DefaultPreference.get(AppStorage.ELECTRUM_SSL_PORT);

      defaultPreferenceServer.host = defaultPreferenceHost;
      defaultPreferenceServer.port = defaultPreferencePort;
      defaultPreferenceServer.sslPort = defaultPreferenceSSLPort;
    } catch {
      console.log('DefaultPreference not set. Most likely Android.');
    }

    this.setState({
      isLoading: false,
      host,
      port,
      sslPort,
      serverHistory,
      defaultPreferenceServer,
    });

    const inverval = setInterval(async () => {
      this.setState({
        config: await BlueElectrum.getConfig(),
      });
    }, 500);

    this.setState({
      config: await BlueElectrum.getConfig(),
      inverval,
    });

    if (this.state.server) {
      Alert.alert(
        loc.formatString(loc.settings.set_electrum_server_as_default, { server: this.state.server }),
        '',
        [
          {
            text: loc._.ok,
            onPress: () => {
              this.onBarScanned(this.state.server);
            },
            style: 'default',
          },
          { text: loc._.cancel, onPress: () => {}, style: 'cancel' },
        ],
        { cancelable: false },
      );
    }
  }

  checkServer = async () => {
    this.setState({ isLoading: true }, async () => {
      const features = await BlueElectrum.serverFeatures();
      alert(JSON.stringify(features, null, 2));
      this.setState({ isLoading: false });
    });
  };

  selectServer = async server => {
    this.setState({ host: server.host, port: server.port, sslPort: server.sslPort }, () => {
      this.save();
    });
  };

  deleteServer = server => {
    Alert.alert(loc.settings.electrum_history, loc.formatString(loc.settings.electrum_delete_server, { server: server.host }), [
      { text: loc._.cancel, onPress: () => console.log('Cancel Pressed'), style: 'cancel' },
      {
        text: loc._.ok,
        onPress: async () => {
          const serverHistory = this.state.serverHistory.filter(savedServer => savedServer !== server);
          await AsyncStorage.setItem(
            AppStorage.ELECTRUM_SERVER_HISTORY,
            JSON.stringify(serverHistory.filter(savedServer => savedServer !== server)),
          );
          LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
          this.setState({ serverHistory });
        },
      },
    ]);
  };

  clearHistoryAlert = () => {
    Alert.alert(loc.settings.electrum_clear_alert_title, loc.settings.electrum_clear_alert_message, [
      { text: loc._.cancel, onPress: () => console.log('Cancel Pressed'), style: 'cancel' },
      { text: loc._.ok, onPress: () => this.clearHistory() },
    ]);
  };

  clearHistory = async () => {
    this.setState({ isLoading: true }, async () => {
      await AsyncStorage.setItem(AppStorage.ELECTRUM_SERVER_HISTORY, JSON.stringify([]));
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      this.setState({
        serverHistory: [],
        isLoading: false,
      });
    });
  };

  resetToDefault = async () => {
    Alert.alert(loc.settings.electrum_reset_to_default, loc.settings.electrum_reset_to_default_message, [
      { text: loc._.cancel, onPress: () => console.log('Cancel Pressed'), style: 'cancel' },
      {
        text: loc._.ok,
        onPress: () => {
          this.setState({ port: '', host: '', sslPort: '' }, () => {
            this.save();
          });
        },
      },
    ]);
  };

  serverExists = server => {
    const { serverHistory } = this.state;
    return serverHistory.some(s => {
      return `${s.host}${s.port}${s.sslPort}` === `${server.host}${server.port}${server.sslPort}`;
    });
  };

  save = () => {
    Keyboard.dismiss();
    const host = this.state.host ? this.state.host : '';
    const port = this.state.port ? this.state.port : '';
    const sslPort = this.state.sslPort ? this.state.sslPort : '';
    const serverHistory = this.state.serverHistory || [];

    this.setState({ isLoading: true }, async () => {
      try {
        if (!host && !port && !sslPort) {
          await AsyncStorage.setItem(AppStorage.ELECTRUM_HOST, '');
          await AsyncStorage.setItem(AppStorage.ELECTRUM_TCP_PORT, '');
          await AsyncStorage.setItem(AppStorage.ELECTRUM_SSL_PORT, '');
          try {
            await DefaultPreference.setName('group.io.bluewallet.bluewallet');
            await DefaultPreference.clear(AppStorage.ELECTRUM_HOST);
            await DefaultPreference.clear(AppStorage.ELECTRUM_SSL_PORT);
            await DefaultPreference.clear(AppStorage.ELECTRUM_TCP_PORT);
            RNWidgetCenter.reloadAllTimelines();
          } catch (e) {
            // Must be running on Android
            console.log(e);
          }
          alert(loc.settings.electrum_saved);
        } else if (!(await BlueElectrum.testConnection(host, port, sslPort))) {
          alert(loc.settings.electrum_error_connect);
        } else {
          await AsyncStorage.setItem(AppStorage.ELECTRUM_HOST, host);
          await AsyncStorage.setItem(AppStorage.ELECTRUM_TCP_PORT, port);
          await AsyncStorage.setItem(AppStorage.ELECTRUM_SSL_PORT, sslPort);

          if (!this.serverExists({ host, port, sslPort })) {
            serverHistory.push({
              host,
              port,
              sslPort,
            });
            await AsyncStorage.setItem(AppStorage.ELECTRUM_SERVER_HISTORY, JSON.stringify(serverHistory));
          }
          try {
            await DefaultPreference.setName('group.io.bluewallet.bluewallet');
            if (host.endsWith('onion')) {
              const randomPeer = await BlueElectrum.getRandomHardcodedPeer();
              await DefaultPreference.set(AppStorage.ELECTRUM_HOST, randomPeer.host);
              await DefaultPreference.set(AppStorage.ELECTRUM_TCP_PORT, randomPeer.tcp);
              await DefaultPreference.set(AppStorage.ELECTRUM_SSL_PORT, randomPeer.ssl);
            } else {
              await DefaultPreference.set(AppStorage.ELECTRUM_HOST, host);
              await DefaultPreference.set(AppStorage.ELECTRUM_TCP_PORT, port);
              await DefaultPreference.set(AppStorage.ELECTRUM_SSL_PORT, sslPort);
            }

            RNWidgetCenter.reloadAllTimelines();
          } catch (e) {
            // Must be running on Android
            console.log(e);
          }

          alert(loc.settings.electrum_saved);
        }
      } catch (error) {
        alert(error);
      }
      this.setState({ isLoading: false });
    });
  };

  onBarScanned = value => {
    if (DeeplinkSchemaMatch.getServerFromSetElectrumServerAction(value)) {
      // in case user scans a QR with a deeplink like `bluewallet:setelectrumserver?server=electrum1.bluewallet.io%3A443%3As`
      value = DeeplinkSchemaMatch.getServerFromSetElectrumServerAction(value);
    }
    var [host, port, type] = value.split(':');
    this.setState({ host: host });
    type === 's' ? this.setState({ sslPort: port }) : this.setState({ port: port });
  };

  handleCopyPress = host => {
    Clipboard.setString(host);
  };

  toolTipMenuOptions = [
    {
      id: 'copyHost',
      label: loc.settings.copy_host,
    },
    {
      id: 'copyPort',
      label: loc.settings.copy_port,
    },
  ];

  handleAndroidPopupMenuAction = ({ item, server }) => {
    if (item.id === 'copyHost') {
      Clipboard.setString(server.host);
    } else if (item.id === 'copyPort') {
      Clipboard.setString(server.port || server.sslPort);
    }
  };

  showAndroidTooltip = server => {
    showPopupMenu(this.toolTipMenuOptions, item => this.handleAndroidPopupMenuAction({ item, server }), this.hostText.current);
  };

  defaultPreferenceAlternateHost = () => {
    const { config, defaultPreferenceServer } = this.state;
    if (
      RNWidgetCenter.widgetCenterSupported &&
      config.host !== defaultPreferenceServer.host &&
      config.port !== defaultPreferenceServer.port &&
      config.sslPort !== defaultPreferenceServer.sslPort
    ) {
      return (
        <BlueText style={styles.torSupported}>
          {loc.formatString(loc.settings.widgets_alternate_host, {
            server: `${this.state.defaultPreferenceServer.host}:${
              this.state.defaultPreferenceServer.sslPort || this.state.defaultPreferenceServer.port
            }`,
          })}
        </BlueText>
      );
    }

    return null;
  };

  render() {
    const host = this.state.host ?? '';
    const port = this.state.port ?? '';
    const sslPort = this.state.sslPort ?? '';
    const serverHistoryItems = this.state.serverHistory.map((server, i) => {
      let host = server.host;
      if (host.length >= 30) host = server.host.substr(0, 6) + '...' + server.host.substr(server.host.length - 12);
      return (
        <View key={i} style={styles.serverHistoryItem}>
          <TouchableWithoutFeedback
            ref={this.hostText}
            onLongPress={() => (Platform.OS === 'ios' ? this.tooltip.current.showMenu() : this.showAndroidTooltip(server))}
          >
            {Platform.OS === 'ios' && (
              <ToolTip
                ref={this.tooltip}
                actions={[
                  {
                    text: loc.settings.copy_host,
                    onPress: () => this.handleCopyPress(host),
                  },
                  {
                    text: loc.settings.copy_port,
                    onPress: () => this.handleCopyPress(server.port || server.sslPort),
                  },
                ]}
              />
            )}
            <BlueText>{`${host}:${server.port || server.sslPort}`}</BlueText>
          </TouchableWithoutFeedback>
          <View style={styles.serverListRowButtonContainer}>
            <TouchableOpacity onPress={() => this.selectServer(server)} style={styles.marginHorizontal24}>
              <Icon type="font-awesome-5" name="plug" color={BlueCurrentTheme.colors.foregroundColor} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => this.deleteServer(server)}>
              <Icon type="font-awesome-5" name="trash" color={BlueCurrentTheme.colors.foregroundColor} />
            </TouchableOpacity>
          </View>
        </View>
      );
    });

    return (
      <SafeBlueArea forceInset={{ horizontal: 'always' }} style={styles.root}>
        <ScrollView>
          <BlueCard>
            <BlueText style={styles.status}>{loc.settings.electrum_status}</BlueText>
            <View style={styles.connectWrap}>
              <View style={[styles.container, this.state.config.connected ? styles.containerConnected : styles.containerDisconnected]}>
                <BlueText style={this.state.config.connected ? styles.textConnected : styles.textDisconnected}>
                  {this.state.config.connected ? loc.settings.electrum_connected : loc.settings.electrum_connected_not}
                </BlueText>
              </View>
            </View>
            <BlueSpacing20 />
            <BlueText style={styles.hostname} onPress={this.checkServer}>
              {this.state.config.host}:{this.state.config.port}
            </BlueText>
          </BlueCard>

          <BlueCard>
            <BlueAddressInput
              onChangeText={text => this.setState({ host: text.trim() })}
              onBarScanned={this.onBarScanned}
              address={this.state.host}
              isLoading={this.state.isLoading}
              placeholder={loc.formatString(loc.settings.electrum_host, { example: '111.222.333.111' })}
              autoCorrect={false}
              autoCapitalize="none"
              underlineColorAndroid="transparent"
              numberOfLines={1}
              launchedBy={this.props.route.name}
              marginHorizontal={0}
              marginVertical={0}
              showFileImportButton
              textContentType="URL"
            />

            <BlueSpacing20 />
            <View style={styles.inputWrap}>
              <TextInput
                placeholder={loc.formatString(loc.settings.electrum_port, { example: '50001' })}
                value={this.state.port}
                onChangeText={text => this.setState({ port: text.trim() })}
                numberOfLines={1}
                style={styles.inputText}
                editable={!this.state.isLoading}
                placeholderTextColor="#81868e"
                underlineColorAndroid="transparent"
                autoCorrect={false}
                autoCapitalize="none"
                keyboardType="numeric"
                inputAccessoryViewID={BlueDismissKeyboardInputAccessory.InputAccessoryViewID}
              />
            </View>
            <BlueSpacing20 />
            <View style={styles.inputWrap}>
              <TextInput
                placeholder={loc.formatString(loc.settings.electrum_port_ssl, { example: '50002' })}
                value={this.state.sslPort}
                onChangeText={text => this.setState({ sslPort: text.trim() })}
                numberOfLines={1}
                style={styles.inputText}
                editable={!this.state.isLoading}
                autoCorrect={false}
                placeholderTextColor="#81868e"
                autoCapitalize="none"
                underlineColorAndroid="transparent"
                keyboardType="numeric"
                inputAccessoryViewID={BlueDismissKeyboardInputAccessory.InputAccessoryViewID}
              />
            </View>
            <BlueSpacing20 />
            <BlueDismissKeyboardInputAccessory />
            <BlueText style={styles.torSupported}>{loc.settings.tor_supported}</BlueText>
            {this.defaultPreferenceAlternateHost()}
            <BlueSpacing20 />
            {this.state.isLoading ? (
              <BlueLoading />
            ) : (
              <BlueButton
                onPress={this.save}
                title={loc.settings.save}
                disabled={host.trim().length === 0 || (sslPort.trim().length === 0 && port.trim().length === 0)}
              />
            )}
            <BlueSpacing20 />
            {!this.state.isLoading && <BlueButton title={loc.settings.electrum_reset} onPress={this.resetToDefault} />}
          </BlueCard>
          {serverHistoryItems.length > 0 && !this.state.isLoading && (
            <BlueCard>
              <View style={styles.serverHistoryTitle}>
                <BlueText style={styles.explain}>{loc.settings.electrum_history}</BlueText>
                <TouchableOpacity onPress={this.clearHistoryAlert}>
                  <BlueText>{loc.settings.electrum_clear}</BlueText>
                </TouchableOpacity>
              </View>
              {serverHistoryItems}
            </BlueCard>
          )}
        </ScrollView>
      </SafeBlueArea>
    );
  }
}

ElectrumSettings.propTypes = {
  navigation: PropTypes.shape({
    navigate: PropTypes.func,
    goBack: PropTypes.func,
  }),
  route: PropTypes.shape({
    name: PropTypes.string,
    params: PropTypes.shape({
      server: PropTypes.string,
    }),
  }),
};

ElectrumSettings.navigationOptions = navigationStyle({}, opts => ({ ...opts, title: loc.settings.electrum_settings }));

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  status: {
    textAlign: 'center',
    color: BlueCurrentTheme.colors.feeText,
    marginBottom: 4,
  },
  connectWrap: {
    width: 'auto',
    height: 34,
    flexWrap: 'wrap',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  marginHorizontal24: { marginHorizontal: 24 },
  container: {
    paddingTop: 6,
    paddingBottom: 6,
    paddingLeft: 16,
    paddingRight: 16,
    borderRadius: 20,
  },
  containerConnected: {
    backgroundColor: BlueCurrentTheme.colors.feeLabel,
  },
  containerDisconnected: {
    backgroundColor: BlueCurrentTheme.colors.redBG,
  },
  textConnected: {
    color: BlueCurrentTheme.colors.feeValue,
    fontWeight: 'bold',
  },
  textDisconnected: {
    color: BlueCurrentTheme.colors.redText,
    fontWeight: 'bold',
  },
  hostname: {
    textAlign: 'center',
    color: BlueCurrentTheme.colors.foregroundColor,
  },
  explain: {
    color: BlueCurrentTheme.colors.feeText,
    marginBottom: -24,
  },
  serverListRowButtonContainer: { flexDirection: 'row', justifyContent: 'space-between' },
  torSupported: {
    textAlign: 'center',
    color: BlueCurrentTheme.colors.feeText,
  },
  inputWrap: {
    flexDirection: 'row',
    borderColor: BlueCurrentTheme.colors.formBorder,
    borderBottomColor: BlueCurrentTheme.colors.formBorder,
    borderWidth: 1,
    borderBottomWidth: 0.5,
    backgroundColor: BlueCurrentTheme.colors.inputBackgroundColor,
    minHeight: 44,
    height: 44,
    alignItems: 'center',
    borderRadius: 4,
  },
  inputText: {
    flex: 1,
    marginHorizontal: 8,
    minHeight: 36,
    color: '#81868e',
    height: 36,
  },
  serverAddTitle: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  serverHistoryTitle: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
  },
  serverHistoryItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 20,
    alignItems: 'center',
    borderBottomColor: BlueCurrentTheme.colors.formBorder,
    borderBottomWidth: 1,
  },
});
