import { Link } from 'expo-router';
import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, TextInput, TouchableOpacity, Image } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Button } from '@react-navigation/elements';
// import { Image } from 'expo-image';

// import * as Progress from 'react-native-progress';


export default function ModalStore() {
  const [energy, setEnergy] = useState(0);
  const [multiply, setMultiply] = useState(1);
  const [maxEnergy, setMaxEnergy] = useState(100);
  const fillStyle = { width: `${energy}%` };
  const [coin, setcoin] = useState(0);
  const [multiplyCoins, setMultiplyCoins] = useState(1)

  // Reset progress when the modal is opened
  useEffect(() => {
    setEnergy(0);
    setMultiply(1);
    setcoin(0);
    setMultiplyCoins(1)
    setMaxEnergy(100)
  }, []);

  // Reset button
  const resetProgress = () => {
    setEnergy(0);
    setMultiply(1);
    setcoin(0);
    setMultiplyCoins(1)
    setMaxEnergy(100)
  };
  
  // Множители
  const multiplyPlus = () => {
      setMultiply(prev => prev + 1);
  };
  const multiplyMulti = () => {
    setMultiply(prev => prev * 2);
  }

  // Обработчик нажатия на кнопку
  const handleValueChange = () => {
    if (energy < maxEnergy) {
      setEnergy(prevCount => prevCount + multiply);
    }
  };

  useEffect(() => {
    if (energy >= maxEnergy) {
      setEnergy(maxEnergy);
    }
    const timerId = setInterval(() => {
      setEnergy((prevCount) => {
        if (prevCount <= 1) {
          clearInterval(timerId);
          return 0;
        }
        return prevCount - 1;
      });
    }, 2000);
  
    return () => clearTimeout(timerId);
  }, [energy]);

  useEffect(() => {
    if (energy > 0) {
      const timerId = setInterval(() => {
        setcoin(prev => prev + multiplyCoins);
      }, 1000);
    return () => clearInterval(timerId);
      }
  });

  const maxEnergyPlus = () => {
    setMaxEnergy(prev => prev + 50);
  }

  const coinsPlus = () => {
      setMultiplyCoins(prev => prev + 5);
  };
  return (
    <ThemedView style={styles.container}>
      <ThemedText type="title">This is a modal</ThemedText>
      <View style={styles.progressTrack}>
          <View style={[styles.progressFill, fillStyle]} aria-label="progress-fill" />
        </View>
        <ThemedText>{ energy }⚡️</ThemedText>
      <TouchableOpacity onPress={handleValueChange}>
        <Image
          source={require('@/assets/images/Shao.png')}
          style={{ width: 350, height: 350 }}
          />
      </TouchableOpacity>
      <View>
        <Button onPress={multiplyPlus}>+1</Button>
        <Button onPress={multiplyMulti}>*2</Button>
      </View>
      <ThemedText>{ energy }</ThemedText>
      <ThemedText>{ multiply }</ThemedText>
      <Link href="/" dismissTo style={styles.link}>
        <ThemedText type="link">Go to home screen</ThemedText>
      </Link>
      <Button onPress={resetProgress}>Reset Progress</Button>
      <ThemedText>{ coin }</ThemedText>
      <Button onPress={maxEnergyPlus}>Max Energy +50</Button>
      <Button onPress={coinsPlus}>Coins +5</Button>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  link: {
    marginTop: 15,
    paddingVertical: 15,
  },
  progressTrack : {
    width: '100%',
    height: 20,
    backgroundColor: '#00000000',
    borderColor: '#202020',
    borderWidth: 2,
    borderRadius: 10,
    overflow: 'hidden',
    marginBottom: 10,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#f14028',
  },
});